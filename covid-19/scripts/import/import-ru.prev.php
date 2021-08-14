<?
$DATA_COUNTRY_NAME = "Russia";	// using in init.lib.php
include_once("init.lib.php");

$REGION_CODE = array();
//TODO: load fresh data from https://xn--80aesfpebagmfblc0a.xn--p1ai/covid_data.json?do=region_stats&code=RU-MOW for each region (official from https://xn--80aesfpebagmfblc0a.xn--p1ai/information/)

$fix_en_names = array(
					"Татарстан"					=> "Republic of Tatarstan",
					"Ставропольский край"		=> "Stavropol Krai",
					"Республика Коми"			=> "Komi Republic",
					"Приморский край"			=> "Primorsky Krai",
					"Липецкая область"			=> "Lipetsk Oblast",
					"Кемеровская область"		=> "Kemerovo Oblast",
					"Калининградская область"	=> "Kaliningrad Oblast",
					"Брянская область"			=> "Bryansk Oblast",
					"Белгородская область"		=> "Belgorod Oblast",
					"Республика Алтай"			=> "Altai Republic",
				);

$ru_names_list = $COVID19DATA->GetCsvDataByUri(__DIR__."/helpers/rus_source_names.csv");
$ru_names = array();
foreach ($ru_names_list as $item)
{
	$iso = explode("-", $item["iso"]);
	if (count($iso) == 1)
		$ru_names["countries"][ $item["name"] ] = $iso[0];
	else
		$ru_names["regions"][ $iso[0] ][ $item["name"] ] = $item["iso"];

	$REGION_CODE[ $item["name"] ] = $item["iso"];
}


$ts = time();
$json_data = null;
$file_data = file_get_contents("https://coronavirus-monitor.ru/jquery-lite-9.js");
if (!empty($file_data))
{
	$pos = strpos($file_data, "{");
	$file_data = substr($file_data, $pos);
	$json_data = json_decode($file_data, true);
	unset($file_data);

	if (!$json_data || !isset($json_data["russianSubjects"]["data"]["subjects"]))
		trigger_error("COVID-19 loader(RUS): Loaded content is broken!" . (!empty($json_data) ? " (changed format?)" : (abs(time()-$ts-ini_get('default_socket_timeout')) < 10 ? " (timeout?)" : "")), E_USER_WARNING);
}
else
	trigger_error("COVID-19 loader(RUS): Loaded content is empty!" . (abs(time()-$ts-ini_get('default_socket_timeout')) < 10 ? " (timeout?)" : ""), E_USER_WARNING);

$funcCollectNewData = function(&$new_data, &$import_data, $first_day_limiter_ts) use (&$REGION_CODE, &$ru_names, &$fix_en_names)
{
	$today_ts = strtotime(date("Y-m-d"));
	$value_types = array(
		"confirmed"	=> "confirmed",
		"cured"		=> "recovered",
		"deaths"	=> "deaths",
	);

	$russian_subjects = $import_data["russianSubjects"]["data"]["subjects"];
	unset($import_data);

	// collect new data
	$new_data = array();
	foreach ($russian_subjects as $region)
	{
		$country_name = ($region["country"] == "Россия" ? "Russia" : "");
		$country_iso = "RU";
		$region_name = trim($region["en"]);
		$region_name_ru = trim($region["ru"]);

		if ($region_name == $region_name_ru)
		{
			if (isset($fix_en_names[$region_name]))
				$region_name = $fix_en_names[$region_name];
			else
				trigger_error("COVID-19: Region name looks like russian: ".$region_name, E_USER_ERROR);
		}

		$region_iso = null;
		if (array_key_exists($region_name, $REGION_CODE))
			$region_iso = $REGION_CODE[ $region_name ];
		else if (isset($ru_names["regions"][$country_iso][ $region_name_ru ]))
			$region_iso = $ru_names["regions"][$country_iso][ $region_name_ru ];
		else
			trigger_error("Unknown region: ".$region_name . "/".$region_name_ru, E_USER_WARNING);

		$data_key = $country_name."/".$region_name;
		if (empty($new_data[ $data_key ]))
			$new_data[ $data_key ] = array(
										"country_name"	=> $country_name,
										"country_iso"	=> $country_iso,
										"region_name"	=> $region_name ?: null,
										"region_name_source"=> (!$region_iso ? $region_name_ru : null),
										"region_iso"	=> $region_iso,
										"lat"			=> !$region["coordinates"][0] && !$region["coordinates"][1] ? null : $region["coordinates"][0],
										"long"			=> !$region["coordinates"][0] && !$region["coordinates"][1] ? null : $region["coordinates"][1],
										"timeline"		=> array()
										);

		foreach ($region["statistics"] as $stat)
		{
			$stat_ts = strtotime($stat["date"]);
			$stat_date = date("Y-m-d", $stat_ts);
			if ($first_day_limiter_ts && ($first_day_limiter_ts > $stat_ts))	// optimize memory usage. Do not import old records
				continue;
			// ignore today. Only passed days with full info
			if ($stat_ts >= $today_ts)
				continue;

			foreach ($value_types as $src_name => $target_name)
			{
//				if (isset($new_data[ $data_key ]["timeline"][$stat_date][$target_name]))
//					$new_data[ $data_key ]["timeline"][$stat_date][$target_name] += intval($stat[$src_name]);
//				else
					$new_data[ $data_key ]["timeline"][$stat_date][$target_name] = intval($stat[$src_name]);
			}
		}
	}
};

if ($json_data)
	$COVID19DATA->ImportData($json_data, $funcCollectNewData, $DATA_COUNTRY_NAME);
?>
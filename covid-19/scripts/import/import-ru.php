<?
$DATA_COUNTRY_NAME = "Russia";	// using in init.lib.php
include_once("init.lib.php");

$fix_service_codes = array(
						// iso			service's
						"RU-AL"		=> "RU-GA",		// Altayskaya respublika
						"RU-43"		=> "RU-CR",		// Krim
						"RU-TA"		=> "RU-TT",		// Tatarstan
						"RU-40"		=> "RU-SEV",	// Sevatopolj
						);
$deprecated_codes = array(
						"RU-AGB",
						"RU-CHI",
						"RU-EVE",
						"RU-KOP",
						"RU-KOR",
						"RU-TAY",
						"RU-UOB",
						);

$REGION_EN_NAMES = array();
$geo_dir = dirname(dirname(dirname(__DIR__))) . "/geo";
$regions_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/iso-3166-2.csv");
foreach ($regions_list as $region)
	$REGION_EN_NAMES[ $region["iso"] ] = $region["name"];

$regions_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/translates/regions/en.csv");
foreach ($regions_list as $region)
	$REGION_EN_NAMES[ $region["iso"] ] = $region["name"];

$REGION_CODES = array();
$ru_names_list = $COVID19DATA->GetCsvDataByUri(__DIR__."/helpers/rus_source_names.csv");
foreach ($ru_names_list as $item)
{
	if (!isset($REGION_EN_NAMES[ $item["iso"] ]))
		trigger_error("COVID-19 pre-loader(".$item["iso"]."): Region is not available in iso-3166-2.csv!", E_USER_WARNING);
	else
		$REGION_CODES[ $item["iso"] ] = $REGION_EN_NAMES[ $item["iso"] ];
}

$ts = time();
$json_data = array();
foreach ($REGION_CODES as $region_code => $region_name)
{
	if (in_array($region_code, $deprecated_codes))
		continue;

	$service_region_code = $region_code;
	if (isset($fix_service_codes[$region_code]))
		$service_region_code = $fix_service_codes[$region_code];
	$file_data = file_get_contents("https://xn--80aesfpebagmfblc0a.xn--p1ai/covid_data.json?do=region_stats&code=".$service_region_code);
	if (!empty($file_data))
	{
		$local_json_data = json_decode($file_data, true);
		unset($file_data);

		if (!$local_json_data || !isset($local_json_data[0]["date"]))
			trigger_error("COVID-19 loader(".$service_region_code."): Loaded content is broken or empty!" . (!empty($local_json_data) ? " (changed format?)" : (abs(time()-$ts-ini_get('default_socket_timeout')) < 10 ? " (timeout?)" : "")), E_USER_WARNING);
		else
		{
			$json_data[$region_code] = $local_json_data;
		}
	}
	else
		trigger_error("COVID-19 loader(".$service_region_code."): Loaded content is empty!" . (abs(time()-$ts-ini_get('default_socket_timeout')) < 10 ? " (timeout?)" : ""), E_USER_WARNING);

	// do not load too fast
	sleep(5);
}

$funcCollectNewData = function(&$new_data, &$import_data, $first_day_limiter_ts) use (&$REGION_CODES)
{
	$today_ts = strtotime(date("Y-m-d"));
	$value_types = array(
		"sick"		=> "confirmed",
		"healed"	=> "recovered",
		"died"		=> "deaths",
		"first"		=> "vaccined",
	);

	// collect new data
	$new_data = array();
	foreach ($import_data as $region_iso => $region_data)
	{
		$country_name = "Russia";
		$country_iso = "RU";
		$region_name = $REGION_CODES[$region_iso];

		$data_key = $country_name."/".$region_name;
		if (empty($new_data[ $data_key ]))
			$new_data[ $data_key ] = array(
										"country_name"	=> $country_name,
										"country_iso"	=> $country_iso,
										"region_name"	=> $region_name ?: null,
										"region_name_source"=> null,
										"region_iso"	=> $region_iso,
										"timeline"		=> array()
										);

		foreach ($region_data as $stat)
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
				if (isset($stat[$src_name]))
					$new_data[ $data_key ]["timeline"][$stat_date][$target_name] = intval($stat[$src_name]);
			}
		}
	}
};

if ($json_data)
	$COVID19DATA->ImportData($json_data, $funcCollectNewData, $DATA_COUNTRY_NAME);
?>
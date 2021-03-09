<?
$DATA_COUNTRY_NAME = null;	// using in init.lib.php
include_once("init.lib.php");

$COUNTRY_CODE = array(
	// ships
	"Diamond Princess"	=> null,
	"MS Zaandam"		=> null
);

$REGION_CODE = array(
	"CA" => array(
		// ships
		"Diamond Princess"			=> null,
		"Grand Princess"			=> null,
		// pseudo regions
		"Repatriated Travellers"	=> null,
	)
);

$JHU_CSSE_names = array();
$JHU_CSSE_names_list = $COVID19DATA->GetCsvDataByUri(__DIR__."/helpers/JHU_CSSE_names.csv");
foreach ($JHU_CSSE_names_list as $item)
{
	if (!$item["region_iso"])
		$JHU_CSSE_names["countries"][ $item["name"] ] = $item["country_iso"];
	else
		$JHU_CSSE_names["regions"][ $item["country_iso"] ][ $item["name"] ] = $item["region_iso"];
}

$geo_dir = dirname(dirname(dirname(__DIR__))) . "/geo";
$regions_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/regions_population.csv");
foreach ($regions_list as $region)
{
	$iso = explode("-", $region["iso"]);
	$REGION_CODE[ $iso[0] ][ $region["name"] ] = $region["iso"];
}

$countries_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/iso-3166-1.csv");
foreach ($countries_list as $region)
	$COUNTRY_CODE[ $region["name"] ] = $region["alpha-2"];


$sources_path = "https://github.com/CSSEGISandData/COVID-19/raw/master/csse_covid_19_data/csse_covid_19_time_series/";
$import_urls = array(
	"confirmed"	=> $sources_path . "time_series_covid19_confirmed_global.csv",
	"recovered"	=> $sources_path . "time_series_covid19_recovered_global.csv",
	"deaths"	=> $sources_path . "time_series_covid19_deaths_global.csv",
	);

$funcCollectNewData = function(&$new_data, &$import_csv, $values_name, $first_day_limiter_ts) use (&$COUNTRY_CODE, &$REGION_CODE, &$JHU_CSSE_names)
{
	$today_ts = strtotime(date("Y-m-d"));

	// get date columns
	$import_dates = array();
	foreach ($import_csv[0] as $k => $v)
		if (is_numeric($k[0]))
			$import_dates[] = $k;

	// collect
	foreach ($import_csv as $region)
		foreach ($import_dates as $date)
		{
			$stat_ts = strtotime($date);
			$stat_date = date("Y-m-d", $stat_ts);
			if ($first_day_limiter_ts && ($first_day_limiter_ts > $stat_ts))	// optimize memory usage. Do not import old records
				continue;
			// ignore today. Only passed days with full info
			if ($stat_ts >= $today_ts)
				continue;

			$country_name = $region["Country/Region"];
			$region_name = $region["Province/State"];

			// skip fake records
			if (($country_name == "Canada") && ($region_name == "Recovered"))
				continue;

			$country_iso = null;
			if (array_key_exists($country_name, $COUNTRY_CODE))
				$country_iso = $COUNTRY_CODE[ $country_name ];
			else if (isset($JHU_CSSE_names["countries"][ $country_name ]))
				$country_iso = $JHU_CSSE_names["countries"][ $country_name ];
			else
				trigger_error("Unknown country: ".$country_name , E_USER_WARNING);

			$region_iso = null;
			if ($region_name)
			{
				if (isset($REGION_CODE[$country_iso]) && array_key_exists($region_name, $REGION_CODE[$country_iso]))
					$region_iso = $REGION_CODE[$country_iso][ $region_name ];
				else if (isset($JHU_CSSE_names["regions"][$country_iso][ $region_name ]))
					$region_iso = $JHU_CSSE_names["regions"][$country_iso][ $region_name ];
				else if (isset($JHU_CSSE_names["countries"][ $region_name ]))					// some regions can be as country. Sample: Saint Helena, Ascension and Tristan da Cunha
				{
					$country_iso = $JHU_CSSE_names["countries"][ $region_name ];
					$country_name = array_search($country_iso, $COUNTRY_CODE);
					$region_name = "";
				}
				else
					trigger_error("Unknown region ({$country_iso}): ".$region_name , E_USER_WARNING);
			}

			$data_key = $country_name."/".$region_name;
			if (empty($new_data[ $data_key ]))
				$new_data[ $data_key ] = array(
											"country_name"	=> $country_name,
											"country_iso"	=> $country_iso,
											"region_name"	=> $region_name ?: null,
											"region_iso"	=> $region_iso,
											"lat"			=> !$region["Lat"] && !$region["Long"] ? null : $region["Lat"],
											"long"			=> !$region["Lat"] && !$region["Long"] ? null : $region["Long"],
											"timeline"		=> array()
											);

			if (isset($new_data[ $data_key ]["timeline"][$stat_date][$values_name]))
				$new_data[ $data_key ]["timeline"][$stat_date][$values_name] += intval($region[$date]);
			else
				$new_data[ $data_key ]["timeline"][$stat_date][$values_name] = intval($region[$date]);
		}

};

$COVID19DATA->ImportCsvData($import_urls, $funcCollectNewData, $DATA_COUNTRY_NAME);
?>
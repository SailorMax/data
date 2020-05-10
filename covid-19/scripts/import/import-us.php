<?
$DATA_COUNTRY_NAME = "US";	// using in init.lib.php
include_once("init.lib.php");

$REGION_CODE = array(
	"Diamond Princess"	=> null,
	"Grand Princess"	=> null,
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
	$REGION_CODE[ $region["name"] ] = $region["iso"];


$sources_path = "https://github.com/CSSEGISandData/COVID-19/raw/master/csse_covid_19_data/csse_covid_19_time_series/";
$import_urls = array(
	"confirmed"	=> $sources_path . "time_series_covid19_confirmed_US.csv",
	"deaths"	=> $sources_path . "time_series_covid19_deaths_US.csv",
	);

$funcCollectNewData = function(&$new_data, &$import_csv, $values_name, $first_day_limiter_ts) use (&$REGION_CODE, &$JHU_CSSE_names)
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

			$country_name = $region["Country_Region"];
			$region_name = $region["Province_State"];

//			$country_iso = $region["iso2"];		// we need country, but it has something another. For Virgin Islands = VI. But has to be US, because we use it as country ID!
			$country_iso = "US";
			$region_iso = null;
			if (array_key_exists($region_name, $REGION_CODE))
				$region_iso = $REGION_CODE[ $region_name ];
			else if (isset($JHU_CSSE_names["regions"][$country_iso][ $region_name ]))
				$region_iso = $JHU_CSSE_names["regions"][$country_iso][ $region_name ];
			else
				trigger_error("Unknown region: ".$region_name , E_USER_WARNING);

			$data_key = $country_name."/".$region_name;
			if (empty($new_data[ $data_key ]))
				$new_data[ $data_key ] = array(
											"country_name"	=> $country_name,
											"country_iso"	=> $country_iso,
											"region_name"	=> $region_name ?: null,
											"region_iso"	=> $region_iso,
											"lat"			=> !$region["Lat"] && !$region["Long_"] ? null : $region["Lat"],
											"long"			=> !$region["Lat"] && !$region["Long_"] ? null : $region["Long_"],
											"timeline"		=> array()
											);

//			if (isset($new_data[ $data_key ]["timeline"][$stat_date][$values_name]))
//				$new_data[ $data_key ]["timeline"][$stat_date][$values_name] += intval($region[$date]);
//			else
				$new_data[ $data_key ]["timeline"][$stat_date][$values_name] = intval($region[$date]);
		}
};

$COVID19DATA->ImportCsvData($import_urls, $funcCollectNewData, $DATA_COUNTRY_NAME);
?>
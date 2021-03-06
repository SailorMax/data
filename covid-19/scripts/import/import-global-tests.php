<?
$DATA_COUNTRY_NAME = "";	// using in init.lib.php
include_once("init.lib.php");

$converter_list = $COVID19DATA->GetCsvDataByUri(__DIR__."/helpers/owid_converter.csv");
$CONVERT_CODES = array();
foreach ($converter_list as $item)
{
	$CONVERT_CODES[ $item["source_name"].":".$item["source_iso"] ] = [
																		"country_iso"	=> $item["country_iso"],
																		"region_iso"	=> $item["region_iso"],
																		];
}

$REGION_CODE3 = array();
$geo_dir = dirname(dirname(dirname(__DIR__))) . "/geo";
$regions_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/iso-3166-1.csv");
foreach ($regions_list as $region)
	$REGION_CODE3[ $region["alpha-3"] ] = $region["alpha-2"];

$sources_path = "https://covid.ourworldindata.org/data/";
$import_urls = array(
	"tested"	=> $sources_path . "owid-covid-data.csv",
	);

$funcCollectNewData = function(&$new_data, &$import_csv, $values_name, $first_day_limiter_ts) use (&$COVID19DATA, &$REGION_CODE3, &$CONVERT_CODES)
{
	$today_ts = strtotime(date("Y-m-d"));
	$new_countries = array();
	$renamed_countries = array();
	$data_fields = array(
					"total_tests"		=> "tested",
					"total_cases"		=> "confirmed",
					"total_deaths"		=> "deaths",
					"people_vaccinated"	=> "vaccined",
					);

	// collect
	foreach ($import_csv as $region_day)
	{
		if (!$region_day["iso_code"] || in_array($region_day["iso_code"], array("OWID_WRL", "OWID_HIC", "OWID_LIC", "OWID_LMC")))	// Pseudo countries (International, World,..)
			continue;

		$stat_ts = strtotime($region_day["date"]) - (60*60*24);	// this source has shifted date by 1 day ahead!
		$stat_date = date("Y-m-d", $stat_ts);
		if ($first_day_limiter_ts && ($first_day_limiter_ts > $stat_ts))	// optimize memory usage. Do not import old records
			continue;
		// ignore today. Only passed days with full info
		if ($stat_ts >= $today_ts)
			continue;

		$country_name = $region_day["location"];

		$country_iso = null;
		$country_iso3 = $region_day["iso_code"];
		$country_key = $country_name.":".$country_iso3;

		if (isset($REGION_CODE3[$country_iso3]))
			$country_iso = $REGION_CODE3[$country_iso3];
		else if (isset($CONVERT_CODES[$country_key]))
			$country_iso = $CONVERT_CODES[$country_key]["country_iso"];
		else
		{
			trigger_error("Can't convert country code '$country_iso3'!", E_USER_WARNING);
			continue;
		}

		$as_new_country = false;
		$region_name = null;
		$region_iso = null;

		if (isset($CONVERT_CODES[$country_key]))
		{
			$country_iso = $CONVERT_CODES[$country_key]["country_iso"];
			$region_iso = $CONVERT_CODES[$country_key]["region_iso"];
			if (($country_iso == "-") && ($region_iso == "-"))
				continue;

			$country_key = $country_name.":".$country_iso.":".$region_iso;
		}

		if (isset($renamed_countries[$country_key]))
		{
			$region = $renamed_countries[$country_key];
			$country_name = $region["country_name"];
			$country_iso = $region["country_iso"];
			$region_name = $region["region_name"];
			$region_iso = $region["region_iso"];
		}
		else if ($region = $COVID19DATA->GetRegionByName($country_name, null, $country_iso))
		{
			if ($country_name !== $region["country_name"])
			{
//				trigger_error("Country has another name: '$country_name' -> '" . $region["country_name"]."/".$region["region_name"] . "'!", E_USER_WARNING);
				$renamed_countries[$country_key] = $region;
				$country_name = $region["country_name"];
				$country_iso = $region["country_iso"];
				$region_name = $region["region_name"];
				$region_iso = $region["region_iso"];
			}
		}
		else
		{
			if (!isset($new_countries[$country_key]))
				trigger_error("New country '$country_name' ($country_iso)!", E_USER_NOTICE);
			$new_countries[$country_key] = 1;
			$as_new_country = true;
		}

		$data_key = $country_name."/".$region_name;
		if (empty($new_data[ $data_key ]))
			$new_data[ $data_key ] = array(
										"country_name"	=> $country_name,
										"country_iso"	=> $country_iso,
										"region_name"	=> $region_name ?: null,
										"region_iso"	=> $region_iso ?: null,
										"timeline"		=> array()
										);

		if ($as_new_country)
		{
			// store all values
			foreach ($data_fields as $source_fname => $fname)
				$new_data[ $data_key ]["timeline"][$stat_date][$fname] = intval($region_day[$source_fname]);
		}
		else
		{
//			$new_data[ $data_key ]["timeline"][$stat_date][$values_name] = intval($region_day["total_tests"]);
			$old_data_region = $COVID19DATA->GetRegionByName($country_name);
			$old_data = null;
			if (!isset($old_data_region["timeline"][$stat_date]) || ($old_data = $old_data_region["timeline"][$stat_date]))
			{
				foreach ($data_fields as $source_fname => $fname)
				{
					if (!$old_data
						|| ($fname == "tested")	// always rewrite
						|| (!$old_data[$fname] && ($region_day[$source_fname] > 0))	// only if empty (this source is not primary)
						)
					{
						$new_data[ $data_key ]["timeline"][$stat_date][$fname] = intval($region_day[$source_fname]);
					}
				}

			}
		}
	}
};

$COVID19DATA->ImportCsvData($import_urls, $funcCollectNewData, $DATA_COUNTRY_NAME);
?>
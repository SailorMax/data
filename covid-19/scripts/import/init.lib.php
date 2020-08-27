<?
set_time_limit(900);					// script timeout
ini_set('default_socket_timeout', 900);	// loader timeout

chdir(__DIR__);

class COVID19DATA
{
	private $new_data;
	private $regions;
	private $timeline = array();

	private $db_path;

	function __construct()
	{
		$data_dir = dirname(dirname(__DIR__));
		$this->db_path = $data_dir."/database.csv";

		$this->LoadDatabase();
	}

	private function LoadDatabase()
	{
		$fp = fopen($this->db_path, "r");
		if ($fp !== false)
		{
			$idx_region = array();
			$country_labels = array("Country"		=> "country_name",
									"Country ISO"	=> "country_iso",
									"Region"		=> "region_name",
									"Region ISO"	=> "region_iso",
									"Lat"			=> "lat",
									"Long"			=> "long",
									"Population"	=> "population",
									);
			$countries_data = array();
			while ($data_row = fgetcsv($fp, 0, ",", '"', "\\"))
			{
				$first_value = $data_row[0];
				if (!$countries_data)
				{
					$first_value = $this->RemoveBomOfTextData($first_value);
					$data_row[0] = $first_value;
				}

				if (isset($country_labels[$first_value]))
				{
					$countries_data[$first_value] = $data_row;
				}
				else
				{
					if (!$idx_region)
					{
						// init
						$this->regions = array();
						foreach ($countries_data["Country"] as $col => $country)
						{
							if ($col < 2)	// data type and date columns
								continue;

							$region_name = $country . "/" . $countries_data["Region"][$col];
							$idx_region[ count($this->regions) ] = $region_name;

							$region_data = array();
							foreach ($country_labels as $label => $fname)
								$region_data[$fname] = $countries_data[$label][$col];
							$region_data["timeline"] = array();
							$this->regions[$region_name] = $region_data;
						}
					}

					// day row
					$date = array_shift($data_row);
					if (strtotime($date) === false)
						trigger_error("Load database: date format is unrecognisable! ($date)", E_USER_ERROR);
					$data_type = array_shift($data_row);
					foreach ($data_row as $col => $value)
					{
						$region_name = $idx_region[$col];
						$region = &$this->regions[$region_name];
						$region_timeline = &$region["timeline"];
						if (!isset($region_timeline[$date]))
							$region_timeline[$date] = array();
						$region_timeline[$date][$data_type] = $value;

						if (!isset($this->timeline[$date]))
							$this->timeline[$date] = array();
						$this->timeline[$date][$region_name] =& $region_timeline[$date];
					}
				}
			}
			fclose($fp);
		}
	}

	function RemoveBomOfTextData($text)
	{
		// remove BOM of UTF8
		$bom = pack ('H*', 'EFBBBF');
		if (substr($text, 0, strlen($bom)) == $bom)
			return substr($text, strlen($bom));
		return $text;
	}

	function GetRegionByName($country_name, $region_name = null, $country_iso = null, $region_iso = null)
	{
		if (isset($this->regions[$country_name."/".$region_name]))
			return $this->regions[$country_name."/".$region_name];
		if ($country_iso)
		{
			// search by iso
			foreach ($this->regions as $region)
				if (($region["country_iso"] == $country_iso) && ($region["region_iso"] == $region_iso))
					return $region;

			// some regions looks like separately countries, like UK colonies (Anguilla, Bermuda,..)
			if (!$region_name && !$region_iso)
				foreach ($this->regions as $region)
					if (($country_name == $region["region_name"]) && ($region["region_iso"] == ($country_iso."-".$country_iso)))
						return $region;
		}
		return null;
	}

	function SaveDatabase()
	{
		$this->ClearOldEmptyData();

		$fp = fopen($this->db_path, "w");
		if ($fp === false)
			trigger_error("Can't open database for write!", E_USER_ERROR);

		$lists = array(
					"country_name"	=> array("Country", ""),
					"country_iso"	=> array("Country ISO", ""),
					"region_name"	=> array("Region", ""),
					"region_iso"	=> array("Region ISO", ""),
					"lat"			=> array("Lat", ""),
					"long"			=> array("Long", ""),
					"population"	=> array("Population", ""),
					);
		$min_date = -1;
		$max_date = -1;

		ksort($this->regions);

		foreach ($this->regions as $region_key => $region)
		{
			foreach ($region["timeline"] as $date => $day_stat)
			{
				$dt = strtotime($date);
				if (($dt < $min_date) || ($min_date == -1))
					$min_date = $dt;
				if (($dt > $max_date) || ($max_date == -1))
					$max_date = $dt;
			}

			$lists["country_name"][]	= $region["country_name"];
			$lists["country_iso"][]		= $region["country_iso"];
			$lists["region_name"][]		= $region["region_name"];
			$lists["region_iso"][]		= $region["region_iso"];
			$lists["lat"][]				= $region["lat"];
			$lists["long"][]			= $region["long"];
			$lists["population"][]		= $region["population"];
		}

		// country name
		fputcsv($fp, $lists["country_name"]);
		fputcsv($fp, $lists["country_iso"]);
		fputcsv($fp, $lists["region_name"]);
		fputcsv($fp, $lists["region_iso"]);
		fputcsv($fp, $lists["lat"]);
		fputcsv($fp, $lists["long"]);
		fputcsv($fp, $lists["population"]);

		$data_types = array("tested", "confirmed", "recovered", "deaths");
		for ($dt = $min_date; $dt <= $max_date; $dt += 60*60*24)
		{
			$row_date = date("Y-m-d", $dt);
			foreach ($data_types as $data_type)
			{
				$row_has_data = false;
				$row = array($row_date, $data_type);
				foreach ($this->regions as $region)
				{
					if (isset($region["timeline"][$row_date][$data_type]) && ($region["timeline"][$row_date][$data_type] > 0))
					{
						$row[] = intval($region["timeline"][$row_date][$data_type]);
						$row_has_data = true;
					}
					else
						$row[] = "";
				}

				if ($row_has_data)
					fputcsv($fp, $row);
			}
		}

		fclose($fp);
	}

	function GetLastDateOfRecords()
	{
		$days = array_keys($this->timeline);
		return array_pop($days);
	}

	function ImportCsvData($import_urls, &$funcCollectNewData, $country_name = null)
	{
		$this->new_data = array();

		// collect new data
		$this->LoadAndCollectCsvData($import_urls, $funcCollectNewData);

		// compare with old data
		$this->SyncAndReduceNewData($country_name);

		if (!empty($this->new_data))
			$this->StoreNewDataToDatabase();

		return count($this->new_data);
	}

	function ImportData(&$import_data, &$funcCollectNewData, $country_name = null)
	{
		$this->new_data = array();

		// collect new data
		$this->CollectData($import_data, $funcCollectNewData);

		// compare with old data
		$this->SyncAndReduceNewData($country_name);

		if (!empty($this->new_data))
			$this->StoreNewDataToDatabase();

		return count($this->new_data);
	}

	function GetCsvDataByUri($import_uri)
	{
/*
		if (substr($import_uri, 0, 4) == "http")
			$import_file = GetRemoteData($import_uri);
		else
*/
			$import_file = file_get_contents($import_uri);

		$import_file = $this->RemoveBomOfTextData($import_file);
		$import_csv = array_map('str_getcsv', explode("\n", rtrim($import_file)));
		array_walk($import_csv, function(&$a) use ($import_csv) { $a = array_combine($import_csv[0], $a); } );
		array_shift($import_csv); # remove column header
		unset($import_file);
		return $import_csv;
	}

	function LoadAndCollectCsvData($import_urls, &$funcCollectNewData)
	{
		$first_day_limiter_ts = 0;
		if ($this->GetLastDateOfRecords())
			$first_day_limiter_ts = strtotime("-1 month");

		foreach ($import_urls as $import_name => $import_uri)
		{
			$import_csv = $this->GetCsvDataByUri($import_uri);
			if ($import_csv && (isset($import_csv[0]["Province_State"]) || isset($import_csv[0]["Province/State"]) || isset($import_csv[0]["total_tests"])))
				$funcCollectNewData($this->new_data, $import_csv, $import_name, $first_day_limiter_ts);
			else
				trigger_error("COVID-19: Loaded content is broken (".$import_name.")!", E_USER_ERROR);

			unset($import_csv);
		}
	}

	function CollectData(&$import_data, &$funcCollectNewData)
	{
		$first_day_limiter_ts = 0;
		if ($this->GetLastDateOfRecords())
			$first_day_limiter_ts = strtotime("-1 month");

		$funcCollectNewData($this->new_data, $import_data, $first_day_limiter_ts);
	}

	function SyncAndReduceNewData($country_name = null)
	{
		$yesterday = date("Y-m-d", strtotime("yesterday"));
		$zero_starts = array();

		foreach ($this->regions as $data_key => $region)
		{
			if ($country_name && ($region["country_name"] != $country_name))
				continue;

			foreach ($region["timeline"] as $date => $day_data)
			{
				if (!isset($zero_starts[$data_key]))
					$zero_starts[$data_key] = $date;
				else if (strtotime($zero_starts[$data_key]) > strtotime($date))
					$zero_starts[$data_key] = $date;

				if (!isset($this->new_data[$data_key]) && $region["country_iso"] && $region["region_iso"])
				{
					// possible changed name
					foreach ($this->new_data as $new_data_region)
						if ((
								($region["country_iso"] == $new_data_region["country_iso"])
								&& ($region["region_iso"] == $new_data_region["region_iso"])
							)
							||
							(
								(!empty($region["lat"]) && !empty($new_data_region["lat"]) && ($region["lat"] == $new_data_region["lat"]))
								&& (!empty($region["long"]) && !empty($new_data_region["long"]) && ($region["long"] == $new_data_region["long"]))
							)
							)
						{
							$new_data_key = $new_data_region["country_name"]."/".$new_data_region["region_name"];
							$this->new_data[$data_key] = $this->new_data[$new_data_key];
							$this->new_data[$data_key]["country_name"] = $region["country_name"];
							$this->new_data[$data_key]["region_name"] = $region["region_name"];
							unset($this->new_data[$new_data_key]);
							trigger_error("COVID-19: region renamed: $data_key -> $new_data_key", E_USER_WARNING);
						}
				}

				if (isset($this->new_data[$data_key]["timeline"][$date]))
				{
					$new_data_row =& $this->new_data[$data_key]["timeline"][$date];
					if ($new_data_row["tested"] == $day_data["tested"]
						&& $new_data_row["confirmed"] == $day_data["confirmed"]
						&& $new_data_row["recovered"] == $day_data["recovered"]
						&& $new_data_row["deaths"] == $day_data["deaths"]
						)
					{
						unset($this->new_data[$data_key]["timeline"][$date]);
					}

					if (!($this->new_data[$data_key]["timeline"]
							|| (!$region["country_iso"] && $this->new_data[$data_key]["country_iso"])
							|| (!$region["region_iso"] && $this->new_data[$data_key]["region_iso"])
							)
						)
					{
						unset($this->new_data[$data_key]);
					}
				}
			}
		}

		// clear old not required zeros days
		if ($zero_starts)
		{
			foreach ($zero_starts as $data_key => $start_date)
				if (isset($this->new_data[$data_key]))
				{
					$start_ts = strtotime($start_date);
					$dates = array_keys($this->new_data[$data_key]["timeline"]);
					foreach ($dates as $date)
						if (strtotime($date) < $start_ts)
							unset($this->new_data[$data_key]["timeline"][$date]);
				}
		}

		return sizeof($this->new_data);	// looks like this run garbadge collector :)
	}

	function StoreNewDataToDatabase()
	{
		$update_stat_fields = array("tested", "confirmed", "recovered", "deaths");

		$updated_regions = array();
		$region_row = null;

		foreach ($this->new_data as $new_region)
		{
			unset($region_row);
			$region_key = $new_region["country_name"]."/".$new_region["region_name"];
			if ($this->regions[ $region_key ])
			{
				$region_row = &$this->regions[ $region_key ];
			}
			else
			{
				if ($new_region["country_iso"] && $new_region["region_iso"])
				{
					foreach ($this->regions as &$old_region)
						if ($old_region["country_iso"] == $new_region["country_iso"] && $old_region["region_iso"] == $new_region["region_iso"])
						{
							$region_row = &$old_region;
							break;
						}
				}

				if (!$region_row)
				{
					$this->regions[$region_key] = $new_region;
					$region_row = &$this->regions[$region_key];
				}
			}

			if ($region_row)
			{
				if ($new_region["population"] && ($region_row["population"] != $new_region["population"]))
					$region_row["population"] = $new_region["population"];
				if ($new_region["country_iso"] && !$region_row["country_iso"])
					$region_row["country_iso"] = $new_region["country_iso"];
				if ($new_region["region_iso"] && !$region_row["region_iso"])
					$region_row["region_iso"] = $new_region["region_iso"];

				foreach ($new_region["timeline"] as $date => $data)
				{
					// fill and make same fields order
					foreach ($update_stat_fields as $field_name)
						if (isset($data[$field_name]))
							$region_row["timeline"][$date][$field_name] = $data[$field_name];
					ksort($region_row["timeline"]);
					//
				}

				$updated_regions[] = $region_key;
			}
			else
				trigger_error("COVID-19: region not found! " . json_encode($new_region, JSON_FORCE_OBJECT), E_USER_ERROR);
		}

//		if ($updated_regions)
//			$this->ClearOldEmptyData($updated_regions);
	}

	function SetupPopulations($code_population)
	{
		$old_code_population = array();
		foreach ($this->regions as &$region)
		{
			$iso = $region["region_iso"];
			if (!$iso && !$region["region_name"])	// some regions hasn't iso (ships) != country!
				$iso = $region["country_iso"];

			if ($iso)
				$old_code_population[$iso] = &$region;
		}

		$switch = array();
		$old_values = null;
		foreach ($code_population as $iso => $population)
		{
			unset($old_values);
			if (isset($old_code_population[$iso]))
				$old_values = &$old_code_population[$iso];
			else if (isset($this->regions[$iso]))			// pseudo countries (ships)
				$old_values = &$this->regions[$iso];

			if ($old_values && $population && ($old_values["population"] != $population))
				$old_values["population"] = $population;
		}
	}

	function ClearOldEmptyData($region_keys = null)
	{
		if (is_null($region_keys))
			$region_keys = array_keys($this->regions);

		foreach ($region_keys as $region_key)
		{
			$region =& $this->regions[$region_key];

			$zero_days = array();
			foreach ($region["timeline"] as $date => $stat_row)
			{
				if (!$stat_row["tested"] && !$stat_row["confirmed"] && !$stat_row["recovered"] && !$stat_row["deaths"])
					$zero_days[] = $date;
				else
				{
					if ($zero_days)
						array_pop($zero_days);	// leave first zero row to be shure about first day = zero day, but not unchecked!
					break;
				}
			}

			foreach ($zero_days as $date)
				unset($region["timeline"][$date]);
		}
	}

	function GetBrokenRegions()
	{
		$exceptions = array(
						// ships
						"Grand Princess",
						"Diamond Princess",
						"MS Zaandam",

						// US specific places
						"Veteran Hospitals",
						"Federal Bureau of Prisons",
						"US Military",
						);

		foreach ($this->regions as $region)
		{
			if (!$region["country_iso"] || !$region["population"] || ($region["region_name"] && !$region["region_iso"]))
			{
				if (in_array($region["country_name"], $exceptions) || in_array($region["region_name"], $exceptions))
					continue;
				$broken_regions[] = $region;
			}
		}
		return $broken_regions;
	}

	function ExportDataToCsv($target_file_path, $ts_limiter = 0, $country_name = null, $value_type = null, $export_fields = null)
	{
		global $MEL, $MEL_CONF, $FILE;

		// get fresh data
		$dates = array();
		$regions = array();

		ksort($this->regions);
		foreach ($this->regions as $region)
		{
			if ($country_name && ($country_name != $region["country_name"]))
				continue;

			$data_key = $region["country_name"]."/".$region["region_name"];
			foreach ($region["timeline"] as $date => $day_stat)
			{
				if (strtotime($date) < $ts_limiter)
					continue;

				if (!isset($regions[$data_key]))
				{
					$new_region = $region;
					$new_region["timeline"] = array();
					$regions[$data_key] = $new_region;
				}
				$regions[$data_key]["timeline"][ $date ] = array(
																		"tested"	=> $day_stat["tested"],
																		"confirmed"	=> $day_stat["confirmed"],
																		"recovered"	=> $day_stat["recovered"],
																		"deaths"	=> $day_stat["deaths"]
																		);
				$dates[ $date ] = 1;
			}
		}

		// sort days
		$dates = array_keys($dates);
		sort($dates);

		// create CSV file
		$fp = fopen($target_file_path, "w");
		if (!$fp)
			trigger_error("COVID-19: Can't open target file!", E_USER_ERROR);

		if (!$export_fields)
			$export_fields = array(
								"country_name"	=> "Country",
								"country_iso"	=> "Country ISO",
								"region_name"	=> "Region",
								"region_iso"	=> "Region ISO",
								"population"	=> "Population",
								);

		// header
		$csv_header = array_values($export_fields);
		if ($value_type)
		{
			foreach ($dates as $date)
				$csv_header[] = date("n/d/y", strtotime($date));	// similar to https://github.com/CSSEGISandData/COVID-19
		}
		else	// global my format
		{
			foreach ($dates as $date)
				$csv_header[] = date("Y-m-d", strtotime($date));
		}
		fputcsv($fp, $csv_header);

		// data
		foreach ($regions as $region)
		{
			$row = array();
			foreach ($export_fields as $field_name => $field_title)
			{
				if ($field_name == "lat" || $field_name == "long")
				{
					$val = rtrim($region[$field_name], "0");
					if (substr($val, strlen($val)-1) == ".")
						$val .= "0";
					$row[] = $val;
				}
				else
					$row[] = $region[$field_name];
			}

			$region_timeline = $region["timeline"];
			foreach ($dates as $date)
			{
				if ($value_type)
				{
					if (isset($region_timeline[$date]))
						$row[] = $region_timeline[$date][$value_type] ?: 0;
					else
						$row[] = 0;
				}
				else	// merged
				{
					if (isset($region_timeline[$date]))
						$row[] = ($region_timeline[$date]["tested"] ?: 0)
									. "/"
									. ($region_timeline[$date]["confirmed"] ?: 0)
									. "/"
									. ($region_timeline[$date]["recovered"] ?: 0)
									. "/"
									. ($region_timeline[$date]["deaths"] ?: 0);
					else
						$row[] = "0/0/0/0";
				}
			}

			fputcsv($fp, $row);
		}
		fclose($fp);

		if (filesize($target_file_path) == 0)
			trigger_error("COVID-19: Export file is empty. Something wrong!", E_USER_ERROR);
	}
}

$COVID19DATA = new COVID19DATA();
if (!isset($DATA_COUNTRY_NAME))
	$DATA_COUNTRY_NAME = null;

$today = date("Y-m-d");
$last_date = $COVID19DATA->GetLastDateOfRecords();
if ($last_date && (strtotime($last_date) >= strtotime($today)))
	trigger_error("Database has future data!", E_USER_ERROR);
?>
<?
include_once("init.lib.php");
//$data_repo_dir = __DIR__."/data-repo/";
$export_dir = dirname(dirname(__DIR__));

// try to fix bad data and old data (refreshed population)
include "setup-attrs.php";

// check bad data
$broken_regions = $COVID19DATA->GetBrokenRegions();
if ($broken_regions)
{
	// or send report
	$details = array();
	foreach ($broken_regions as $region_row)
	{
		if (!$region_row["country_iso"])
			$details[] = "Country '".$region_row["country_name"]."' has not ISO!";
		if ($region_row["region_name"] && !$region_row["region_iso"])
			$details[] = "Region '".$region_row["country_name"]." / ".$region_row["region_name"]."' (".(isset($region_row["region_name_source"]) ? $region_row["region_name_source"] : "").") has no ISO!";
		if (!$region_row["population"])
			$details[] = "Region '".$region_row["country_name"]." / ".$region_row["region_name"]."' (".(isset($region_row["region_name_source"]) ? $region_row["region_name_source"] : "").") has no population!";
	}

	$email_args = array(
					"to"			=> "sailormax@live.com",
					"subject"		=> "covid-19: broken regions!",
					"body"			=> "Regions has broken values:\n".implode("\n", $details)."\n",
					);
	mail($email_args["to"], $email_args["subject"], $email_args["body"]);
	trigger_error($email_args["body"], E_USER_WARNING);
}
//

/*
$is_windows = preg_match("/^[a-z]\:/i", $data_repo_dir);	// if path start from letter => this is windows

// git pull
$out = "";
$result = 0;
$commands = array(
				'cd '.($is_windows ? "/d" : "" ).' "'.$data_repo_dir.'"',
				'git pull --no-edit',
				);
@exec( implode(" && ", $commands), $out, $result );
if ($result != 0)
	trigger_error("git pull problem: " . json_encode($out), E_USER_WARNING);
*/

// export anyway
$COVID19DATA->ExportDataToCsv($export_dir."/31days_covid19_merged_global.csv", strtotime("-31 days"));

$JHU_CSSE_fields = array(
						"region_name"	=> "Province/State",
						"country_name"	=> "Country/Region",
						"lat"			=> "Lat",
						"long"			=> "Long",
						);
$COVID19DATA->ExportDataToCsv($export_dir."/time_series_covid19_tested_global.csv", 0, null, "tested", $JHU_CSSE_fields);
$COVID19DATA->ExportDataToCsv($export_dir."/time_series_covid19_confirmed_global.csv", 0, null, "confirmed", $JHU_CSSE_fields);
$COVID19DATA->ExportDataToCsv($export_dir."/time_series_covid19_recovered_global.csv", 0, null, "recovered", $JHU_CSSE_fields);
$COVID19DATA->ExportDataToCsv($export_dir."/time_series_covid19_deaths_global.csv", 0, null, "deaths", $JHU_CSSE_fields);

/*
// git push
$out = "";
$result = 0;
$commands = array(
				'cd '.($is_windows ? "/d" : "" ).' "'.$data_repo_dir.'"',
				'git add .',
				'git commit -m "covid-19 data update"',
				'git push',
				);
@exec( implode(" && ", $commands), $out, $result );
if ($result != 0)
	trigger_error("git push problem: " . json_encode($out), E_USER_WARNING);
*/
?>
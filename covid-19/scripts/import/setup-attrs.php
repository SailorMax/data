<?
include_once("init.lib.php");

// population
$CODE_POPULATIONS = array(
						// ships
						"Diamond Princess/"			=> 3711,
						"US/Diamond Princess"		=> 3711,
						"Canada/Diamond Princess"	=> 3711,

						"Grand Princess/"		=> 3533,
						"US/Grand Princess"		=> 3533,
						"Canada/Grand Princess"	=> 3533,

						"MS Zaandam/"			=> 1829,
						);

$geo_dir = dirname(dirname(dirname(__DIR__))) . "/geo";
$countries_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/countries_population.csv");
foreach ($countries_list as $country)
	$CODE_POPULATIONS[ $country["alpha-2"] ] = $country["population"];

$regions_list = $COVID19DATA->GetCsvDataByUri($geo_dir."/regions_population.csv");
foreach ($regions_list as $region)
	$CODE_POPULATIONS[ $region["iso"] ] = $region["population"];

$COVID19DATA->SetupPopulations($CODE_POPULATIONS);
//

// setup lat/long
//
?>
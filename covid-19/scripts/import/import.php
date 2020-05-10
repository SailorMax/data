<?
include_once("init.lib.php");

include("import-global.php");
include("import-us.php");
include("import-ru.php");

include("import-global-tests.php");

// try to fix bad data and old data (refreshed population)
include "setup-attrs.php";

$COVID19DATA->SaveDatabase();

//include "export.php";
?>
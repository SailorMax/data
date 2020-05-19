<?
print "> Init\n";
include_once("init.lib.php");

print "> Import global data\n";
include("import-global.php");
print "> Import US data\n";
include("import-us.php");
print "> Import RU data\n";
include("import-ru.php");

print "> Import tests data\n";
include("import-global-tests.php");

// try to fix bad data and old data (refreshed population)
print "> Setup attributes\n";
include "setup-attrs.php";

$COVID19DATA->SaveDatabase();

include "export.php";
?>
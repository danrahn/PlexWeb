<?php

require_once("includes/common.php");

// For post requests, don't load the error page, create the actual error header
if ($_SERVER['REQUEST_METHOD'] === 'POST')
{
    header(HTTPStatusHeader($status), TRUE, $status);
    exit;
}

$page_redirected_from = $_SERVER['REQUEST_URI'];
$page_redirected_from = substr($page_redirected_from, 1);
$rpos = strrpos($page_redirected_from, '?');
if ($rpos !== FALSE)
{
	$page_redirected_from = substr($page_redirected_from, 0, $rpos);
}
$err = getenv("REDIRECT_STATUS");
if (isset($_GET['r']))
{
	$err = (int)$_GET['r'];
    header(HTTPStatusHeader($err), FALSE, $err);
}

$explanation = "";
$has_exp = FALSE;
if (isset($_GET['m']) && strlen($_GET['m']) != 0)
{
	$explanation = $_GET['m'];
	$has_exp = TRUE;
}

$description = "";
$frown = ":(";
switch($err)
{
	case 400:
		$error_code = "400";
		$explanation = $has_exp ? $explanation : "Bad request! Invalid parameters for " . $page_redirected_from;
		$description = "Bad Request";
		break;
	case 401:
		$error_code = "401";
		$explanation = $has_exp ? $explanation : "You don't have access to " . $page_redirected_from . "! Contact Daniel for more information";
		$description = "Unauthorized";
		break;
	case 403:
		$error_code = "403";
		$explanation = $has_exp ? $explanation : "Forbidden! You don't have access to " .$page_redirected_from;
		$description = "Forbidden";
		$frown = ">:(";
		break;
	case 404:
		$error_code = "404";
		$explanation = $has_exp ? $explanation : "Sorry! we couldn't find " . $page_redirected_from;
		$description = "Not Found";
		break;
	case 500:
		$error_code = "500";
		$explanation = $has_exp ? $explanation : "Something went wrong on our end, sorry! If this continues, please contact the administrator";
		$description = "Internal Server Error";
		break;
	default:
		$error_code = "(Unknown)";
		$explanation = $has_exp ? $explanation : "An unknown error occurred! Please try again later, or contact the administrator if it continues to happen";
		$description = "Unknown";
		break;
}
?>

<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-us">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#220202" />
    <link rel="icon" type="image/svg+xml" href="/plex/favicon.svg">
    <link rel="alternate icon" href="/plex/favicon.png">
	<title>Error <?php print($error_code . " - " . $description); ?></title>
	<style>
	* {
		font-family: sans-serif;
		text-align: center;
	}

	body {
		background: #442222;
		color: #a1a1a1;
	}

	a {
		color: #9191e1;
	}

	h1 {
		font-size: 144pt;
	}

	h2 {
		font-size: 36pt;
	}
	</style>
</head>
<body>

<h1><?= $frown ?></h1>
<h2>Error <?php print ($error_code); ?></h2>
<h3><?= $explanation ?></h3>

</body>
</html>

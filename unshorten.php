<?php
/// <summary>
/// Expand a shorten url.
///
/// Currently only supports a single option, expanding plex/r/# to plex/request.php?id=#
/// </summary>

require_once "includes/common.php";
require_once "includes/config.php";

session_start();
requireSSL();

$type = try_get('type');
$data = try_get('data');
if (!$type || !$data)
{
    header("Location: /plex/index.php");
    exit;
}

switch ($type)
{
    case 'r':
        header('Location: /plex/request.php?id=' . $data);
        exit;
    default:
        header('Location: /plex/index.php');
        break;
}

?>
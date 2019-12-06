<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
verify_loggedin(TRUE /*redirect*/, "requests.php");

?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="stylesheet" type="text/css" href="resource/requests.css">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <script src="resource/consolelog.js"></script>
    <script src="resource/queryStatus.js"></script>
    <script src="resource/requests.js"></script>
    <script src="resource/min/animate.min.js"></script>
    <title>Plex Requests</title>
</head>

<body isAdmin="<?= (isset($_SESSION['level']) && $_SESSION['level'] >= 100) ? 1 : 0 ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <div class="tableHolder">
                <div id="tableHeader" class="tableHF">
                    <button class="previousPage" title="Previous Page"><img src="arrow.png" alt="Previous Page" /></button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1" title="Select Page"> of <span class="pageCount">1</span></div>
                    <div class="rightSide">
                        <button class="filterBtn"><img class="filterImg" src="filter.png" alt="Filter" title="Filter Results" /></button><button class="nextPage" title="Next Page"><img src="arrow.png" alt="Next Page" /></button>
                    </div>
                </div>
                <div id="tableEntries"></div>
                <div id="tableFooter" class="tableHF">
                    <button class="previousPage" title="Previous Page"><img src="arrow.png" alt="Previous Page" /></button>
                    <div class="largeShow">
                        <span>Show:</span>
                        <button class="ppButton" value="25">25</button><button class="ppButton" value="50">50</button><button class="ppButton" value="100">100</button><button class="ppButton cap" value="0">All</button>
                    </div>
                    <div class="pageStatus">Page <input type="text" class="pageSelect" value="1" title="Select Page"> of <span class="pageCount">1</span></div>
                    <div class="rightSide">
                        <button class="filterBtn"><img class="filterImg" src="filter.png" alt="Filter" title="Filter Results" /></button><button class="nextPage" title="Next Page"><img src="arrow.png" alt="Next Page" /></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
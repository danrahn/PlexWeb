<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(true, "new_request.php");
requireSSL();
?>


<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="stylesheet" type="text/css" href="resource/new_request.css">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/consolelog.js"></script>
    <script src="resource/min/animate.min.js"></script>
    <script src="resource/queryStatus.js"></script>
    <script src="resource/new_request.js"></script>
    <title>New Plex Request</title>
</head>
<body>
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="suggest" class="formContainer">
            <div class="formTitle">New Request</div>
            <form id="suggestForm" action="javascript:void(0);">
                <hr />
                <div class="formInput"><label for="type">Suggestion Type: </label><select name="type" id="type">
                    <option value="none"></option>
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                    <option value="audiobook">Audiobook</option>
                    <option value="music">Music</option>
                </select></div>
                <div class="formInput" id="nameHolder"><label for="name">Suggestion:</label><input type="text" name="name" id="name" maxlength=128></div>
                <div id="matchHolder">
                    <div id="matchContainer"></div>
                    <div id="imdbContainer" class="hidden">
                        <div class='formInput' id="external_holder"><hr /><label for='external_id'>--OR-- IMDb ID:</label><input type=text style="float: left; margin-left: 10px" id='external_id' placeholder='tt1234567'></div>
                        <div id="imdbResult"></div>
                    </div>
                </div>
                <div id="suggestions">
                    <div id="outsideSuggestions">
                        <h4>Matches</h4>
                    </div>
                    <div id="existingSuggestions">
                        <h4>Existing Items</h4>
                    </div>
                </div>
                <div class="formInput" id="submitHolder"><input type="button" value="Submit" id="go"></input></div>
            </form>
            <hr />
            <a href="user_settings.php">Change notification settings</a>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
    <div id="tooltip"></div>
</div>
</body>
</html>
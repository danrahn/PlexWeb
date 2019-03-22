<?php
session_start();

requireSSL();
function requireSSL() {
    if ($_SERVER["REMOTE_ADDR"] != "::1" && $_SERVER["REMOTE_ADDR"] != "127.0.0.1" && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] == 'off')) {
        header("Location: https://" . $_SERVER["HTTP_HOST"] . $_SERVER["REQUEST_URI"]);
        exit();
    }
}

$_SESSION = array();
session_destroy();
header("location: login.php");
exit;
?>
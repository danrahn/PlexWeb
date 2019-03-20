<?php

// This is a dummy config file that mirrors the actual config.php that exists in
// the same directlry. Replace values with the actual usernames/passwords/etc, and
// rename/copy to config.php
define('DB_SERVER', 'server:port');
define('DB_USERNAME', 'username');
define('DB_PASSWORD', 'password');
define('DB_NAME', 'dbname');
define('TVDB_TOKEN', 'TVDatabaseToken');
define('MAIL_USER', 'emailusername');
define('MAIL_PASS', 'emailpassword');
define('MAIL_HOST', 'emailhost');
define('ADMIN_PHONE', 'adminphone@carrier');
define("PLEX_TOKEN", 'plexApiToken');

$db = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);
if ($db->connect_error)
{
	die("ERROR: Could not connect. " . $db->connect_error);
}

?>
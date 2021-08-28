<?php

// This is a dummy config file that mirrors the actual config.php that exists in
// the same directory. Replace values with the actual usernames/passwords/etc, and
// rename/copy to config.php
define('DB_SERVER', 'server:port');
define('DB_USERNAME', 'username');
define('DB_PASSWORD', 'password');
define('DB_NAME', 'dbname');
define('TVDB_TOKEN', 'TVDatabaseToken');
define('MAIL_USER', 'emailusername');

// If MAIL_ALIAS is not the same as MAIL_USER, emails will be sent from MAIL_ALIAS. If being sent from
// an alias, MAIL_PASS must be the password for the alias account, not the owning MAIL_USER password
define('MAIL_ALIAS', 'alias@mydomain.com');
define('MAIL_PASS', 'emailpassword');
define('MAIL_HOST', 'emailhost');

define('ADMIN_PHONE', 'adminphone@carrier');
define("PLEX_TOKEN", 'plexApiToken');
define('PLEX_HOST', 'plexHost');
define('PLEX_PORT', 'plexPort');
define('PLEX_SERVER', 'http://' . PLEX_HOST . ':' . PLEX_PORT);
define('GEOIP_TOKEN', 'ipgeolocationToken');
define('GEOIP_URL', 'https://api.ipgeolocation.io/ipgeo?apiKey=' . GEOIP_TOKEN . '&ip=');
define('TMDB_TOKEN', "?api_key=<KEY>");
define('TMDB_URL', "https://api.themoviedb.org/3/");
define('BACKING_STORAGE', []); // Location(s) on disk of the plex library, used for storage calculations
define('PUBLIC_PLEX_HOST', 'https://app.plex.tv'); // Can also forward to custom plex-hosting domain
define('PUBLIC_PLEX_NAV', 'desktop#!'); // For custom plex-hosted domains, this will likely be 'web/index.html#!/'
define('SITE_DOMAIN', 'www.example.com'); // Root domain
define('SITE_SHORT_DOMAIN', 'www.example.com/plexweb'); // where the PlexWeb root lives (potentially the same as SITE_DOMAIN)
define('LIBRARIES',
    [
        "MOVIES" => "Movies",
        "TV" => "TV Shows",
        "MUSIC" => "Music",
        "AUDIOBOOKS" => "Audiobooks"
    ]
); // Map of Plex library types to library names

// ZFS connection info. Very specific to users who have a
// network-attached ZFS pool storing their media
define('ZFS_STATS', FALSE);
define('SSH_IP', '127.0.0.1');
define('SSH_USER', 'plex');
define('SSH_PASS', 'plex');
define('ZFS_SHARE', 'pool');

$db = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);
if ($db->connect_error)
{
    die("ERROR: Could not connect. " . $db->connect_error);
}

?>
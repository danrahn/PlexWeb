<?php
session_start();

require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
verify_loggedin(TRUE /*redirect*/);

$type = RequestType::get_type((int)param_or_die('type'));
$imdb = try_get('imdb');
$by_id = try_get('by_id');
$query = param_or_die('query');

if ($imdb)
{
    $endpoint = "find/" . $query;
    $params = [
        'external_source' => 'imdb_id'
    ];

    json_message_and_exit(run_query($endpoint, $params));
}

if ($by_id)
{
    switch($type)
    {
        case RequestType::Movie:
            $endpoint = "movie/" . $query;
            $params = [ ];
            json_message_and_exit(run_query($endpoint, $params));
        case RequestType::TVShow:
            $endpoint = "tv/" . $query;
            $params = [ ];
            json_message_and_exit(run_query($endpoint, $params));
        default:
            json_error_and_exit("Unsupported media type");
    }
}

switch ($type)
{
    case RequestType::Movie:
        $endpoint = "search/movie";
        $params = [ "query" => urlencode($query) ];
        json_message_and_exit(run_query($endpoint, $params));
    case RequestType::TVShow:
        $endpoint = "search/tv";
        $params = [ "query" => urlencode($query) ];
        json_message_and_exit(run_query($endpoint, $params));
    default:
        json_error_and_exit("Unsupported media type");

}

function run_query($endpoint, $params)
{
    $query = TMDB_URL . $endpoint . TMDB_TOKEN;
    foreach ($params as $key => $value)
    {
        $query .= "&" . $key . "=" . $value;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $query);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

    $return = curl_exec($ch);
    curl_close($ch);
    return $return;
}
?>
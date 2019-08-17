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

            // TV shows don't list imdb id in the main results page. Query for that as well and append it to the object
            json_message_and_exit(json_encode(parse_single_tv_show(run_query($endpoint, $params))));
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

function parse_single_tv_show($show)
{
    $show = json_decode($show);
    $id = $show->id;
    $show->imdb_id = get_imdb_id_for_tv($show->id);
    return $show;
}

function get_imdb_id_for_tv($id)
{
    $endpoint = "tv/" . $id . "/external_ids";
    $parameters = [];
    $result = json_decode(run_query($endpoint, $parameters));
    return $result->imdb_id;
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
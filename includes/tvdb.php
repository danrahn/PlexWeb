<?php

require_once "includes/config.php";

/// <summary>
/// A class containing relevant Episode information. imdbId is currently
/// the only field that's actually used
/// </summary>
class Episode
{
    private $id;
    private $season;
    private $episode;
    private $name;
    private $imdb;
    public function __construct($tvdb, $data)
    {
        if (!isset($data['data']) || count($data['data']) != 1)
        {
            if (isset($data['Error']))
            {
                $this->error = $data['Error'];
            }
            else if (isset($data['data']) && count($data['data']) != 1)
            {
                $this->error = "Episode query was ambiguous";
            }

            $this->error = "Something went wrong";
            return;
        }

        $this->error = false;

        $data = $data['data'][0];
        $this->id = $data['id'];
        $this->season = $data['airedSeason'];
        $this->episode = $data['airedEpisodeNumber'];
        $this->name = $data['episodeName'] ?? "";
        $this->imdb = $data['imdbId'] ?? "";

        // If we have no imdbId, attempt to get the imdbId of the series to at
        // least link to something
        if (strlen($this->imdb) == 0 && isset($data['seriesId']))
        {
            $this->imdb = $this->getBackupId($tvdb, $data['seriesId']);
        }
    }

    public function isError()
    {
        return !!$this->error;
    }

    public function getError()
    {
        return $this->error;
    }

    public function getId()
    {
        return $this->id;
    }

    public function getSeason()
    {
        return $this->season;
    }

    public function getEpisodeNumber()
    {
        return $this->episode;
    }

    public function getName()
    {
        return $this->name;
    }

    public function getImdbLink()
    {
        return $this->imdb;
    }

    /// <summary>
    /// If we don't have an episode-specific IMdB id, attempt to grab the id of
    /// the series itself to avoid 404 errors
    /// </summary>
    private function getBackupId($tvdb, $seriesId)
    {
        if (!$tvdb->ready())
        {
            $tvdb->login();
        }

        return $tvdb->get_series($seriesId)['imdbId'];
    }
}

/// <summary>
/// A very slim TVDB API client. Only supports grabbing a single episode
/// based on showId, season number, and episode number of the season
/// </summary>
class Tvdb
{
    private const BASE_URI = "https://api.thetvdb.com/";
    private $token = "";

    public function __construct()
    {
        $this->login();
    }

    public function login()
    {
        $data = [ 'apikey' => TVDB_TOKEN ];
        $response = $this->apiCall('POST', 'login', $data);
        $response = json_decode($response, true);
        if (isset($response['Error']))
        {
            $this->token = "";
        }
        else
        {
            $this->token = $response['token'];
        }
    }

    /// <summary>
    /// Returns whether the client is ready for queries (i.e. token is set)
    /// </summary>
    function ready()
    {
        return !!$this->token;
    }

    /// <summary>
    /// Get a single episode given the show, season, and episode numbers
    /// </summary>
    function get_episode($showId, $season, $episode)
    {
        $data = [ "airedSeason" => $season, "airedEpisode" => $episode ];
        $response = json_decode($this->apiCall('GET', 'series/' . $showId . "/episodes/query", $data), true);
        return new Episode($this, $response);
    }

    function get_series($showId)
    {
        $data = [];
        $response = json_decode($this->apiCall('GET', 'series/' . $showId, $data), true);
        return $response['data'];
    }

    function get_season_episodes($showId, $season)
    {
        $data = [];
        $response = json_decode($this->apiCall('GET', 'series/' . $showId . '/episodes/query', array('airedSeason' => $season)));
        return $response->data;
    }

    /// <summary>
    /// Makes a request to the tvdb api with the given data
    /// </summary>
    private function apiCall($method, $path, $data = [])
    {
        $url = self::BASE_URI . $path;
        if (strtolower($method) == "get")
        {
            return $this->curl_get($url . "?" . http_build_query($data));
        }
        else
        {
            return $this->curl_post($url, $data);
        }
    }

    /// <summary>
    /// Send a GET request to the tvdb api, with a json header
    /// </summary>
    private function curl_get($path)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $path);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Accept: application/json',
            'Authorization: Bearer ' . $this->token
        ));

        $data = curl_exec($ch);
        curl_close($ch);
        return $data;
    }

    /// <summary>
    /// Sends a POST request to the tvdb api with the given data
    /// </summary>
    private function curl_post($path, $data)
    {
        $fields = json_encode($data);
        $ch = curl_init($path);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json', 'Accept: application/json'));

        $data = curl_exec($ch);
        curl_close($ch);
        return $data;
    }
}
?>

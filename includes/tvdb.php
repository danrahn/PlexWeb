<?php
/// <summary>
/// (Very) lightweight PHP API for thetvdb.com
/// </summary>
require_once "includes/config.php";

/// </summary>
/// Base class for episodes and series (and potentially in the future, seasons)
/// </summary
class Media
{
    protected $error;
    public function check_error($data, $episode)
    {
        if (isset($data['data']) && (!$episode || count($data['data']) == 1))
        {
            $this->error = FALSE;
            return FALSE;
        }

        if (isset($data['Error']))
        {
            $this->error = $data['Error'];
        }
        else if (isset($data['data']) && count($data['data']) != 1)
        {
            $this->error = "Episode query was ambiguous";
        }
        else
        {
            $this->error = "Something went wrong";
        }

        return TRUE;
    }

    public function isError()
    {
        return !!$this->error;
    }

    public function getError()
    {
        return $this->error;
    }
}

/// <summary>
/// A class containing relevant Episode information. imdbId is currently
/// the only field that's actually used
/// </summary>
class Episode extends Media
{
    private $id;
    private $season;
    private $episode;
    private $name;
    private $imdb;

    /// <summary>
    /// Creates a new Episode. If the given data indicates and error,
    /// sets the error and leaves the rest of the object empty
    /// </summary>
    public function __construct($tvdb, $data)
    {
        if ($this->check_error($data, true /*episode*/))
        {
            return;
        }

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

        return $tvdb->get_series($seriesId)->getImdbLink();
    }
}

/// <summary>
/// Simple class that defines a series
/// </summary>
class Series extends Media
{
    private $id;
    private $imdb;
    private $name;
    private $seasons;

    public function __construct($data)
    {
        if ($this->check_error($data, false /*episode*/))
        {
            return;
        }

        $data = $data['data'];
        $this->id = $data['id'];
        $this->seasons = $data['season'];
        $this->name = $data['seriesName'] ?? "";
        $this->imdb = $data['imdbId'] ?? "";
    }

    public function getId()
    {
        return $this->id;
    }

    public function getName()
    {
        return $this->name;
    }

    public function getSeasonCount()
    {
        return $this->seasons;
    }

    public function getImdbLink()
    {
        return $this->imdb;
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

    /// <summary>
    /// Logs in and gets the API token from thetvdb
    /// </summary>
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

    /// <summary>
    /// Get information for an entire series
    /// </summary>
    function get_series($showId)
    {
        $data = [];
        $response = json_decode($this->apiCall('GET', 'series/' . $showId, $data), true);
        return new Series($response);
    }

    /// <summary>
    /// Returns all episodes for a given season
    /// </summary>
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

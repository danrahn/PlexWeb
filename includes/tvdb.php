<?php

require_once "includes/config.php";
class Episode
{
    private $id;
    private $season;
    private $episode;
    private $name;
    private $imdb;
    public function __construct($data)
    {
        if (!isset($data['data']) || count($data['data']) != 1)
        {
            if (isset($data['Error']))
            {
                $this->error = $data['Error'];
            }
            else if (count($data['data']) != 1)
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
}

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

    function ready()
    {
        return !!$this->token;
    }

    function get_episode($showId, $season, $episode)
    {
        $data = [ "airedSeason" => $season, "airedEpisode" => $episode ];
        $response = json_decode($this->apiCall('GET', 'series/' . $showId . "/episodes/query", $data), true);
        return new Episode($response);
    }

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
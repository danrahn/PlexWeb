<?php
/// <summary>
/// Updates IMDb ratings. Pulls down the latest data from IMDb, parses it, and replaces
/// our cached table with the data
/// </summary>
/// <remarks>
/// There's little/no protection here, as we're relying on httpd.conf blocking this file
/// to anything but local connections, forcing this to only be called in (hopefully) valid
/// server-side scenarios.
/// </remarks>

require_once "common.php";
require_once "config.php";
requireSSL();

function update_status($status, $message)
{
    $json = new \stdClass();
    $json->status = $status;
    $json->message = $message;
    write_status(json_encode($json));
}

function write_status($status)
{
    file_put_contents("status.json", $status);
}

global $db;
// Need to find where we can store our tsv for SQL consumption, since we should assume --secure-file-priv is set.
$save_root = "";
$locations = $db->query("SHOW VARIABLES LIKE 'secure_file_priv'");
if ($locations !== FALSE && $locations->num_rows > 0)
{
    // On Windows, even though the location is reported with backslashes
    // as the directory separator, we get permission errors if we don't convert
    // them to forward slashes when attempting to load the file.
    $save_root = str_replace("\\", "/", $locations->fetch_row()[1]);
}

// Using a text file is a horrible way to go about this, but it works
update_status("In Progress", "Downloading content");
$start = microtime(TRUE);
$file = $save_root . "title.ratings.tsv";
$url = "https://datasets.imdbws.com/title.ratings.tsv.gz";
$result = curl($url, Array(
    CURLOPT_HEADER => 0,
    CURLOPT_TIMEOUT => 60 // This is under 6MB, so it better not take more than a minute!
));

if ($result[0] == '{')
{
    // This smells like a curl error
    update_status("Failed", "Unable to get data from IMDb");
    die();
}

$data = gzdecode($result);

// Writing to an output file isn't really necessary, but it makes checking
// the last modified date easier.
$output = fopen($file, "w");
if (fwrite($output, $data) === FALSE)
{
    update_status("Failed", "Unable to write to tsv file");
    fclose($output);
    die();
}

fclose($output);


update_status("In Progress", "Download Complete (" . round(microtime(TRUE) - $start, 2) . " seconds)");

$rows = explode("\n", $data);

// Autocommit can kill the speed of this operation, especially if we can't use LOAD DATA INFILE.
if (!$db->autocommit(FALSE))
{
    update_status("Failed", "Could not turn off autocommit: $db->error");
    die();
}

// Better to just clear it out and re-fill. 'ON DUPLICATE KEY UPDATE' is a possibility, but this is
// likely more performant when dealing with 1M+ rows that are mostly duplicates.
if (!$db->query("TRUNCATE TABLE `imdb_ratings`"))
{
    update_status("Failed", "Could not clear ratings table: $db->error");
    die();
}

$success = FALSE;
if ($save_root != "")
{
    // We were able to find an allowed location to store our ratings
    update_status("In Progress", "Importing from file");
    $infile_query = <<<SQL
LOAD DATA INFILE "$file"
INTO TABLE `imdb_ratings`
    IGNORE 1 LINES
    (@imdbid, @rating, votes)
    SET `imdbid` = CAST(SUBSTRING(@imdbid, 3) AS UNSIGNED),
    `rating` = ROUND(@rating * 10)
SQL;

    if (!$db->query($infile_query))
    {
        update_status("Failed", "Could not update imdb_ratings: $db->error");
        die();
    }

    $success = TRUE;
}

$total = count($rows);
if (!$success)
{
    // Either we failed to import the tsv directly, or we never tried in the first place.
    // Try batch INSERTing instead.
    update_status("In Progress", "Reading file content");
    $data = file_get_contents($save_root . "title.ratings.tsv");

    // Couldn't find a place for MySQL to read our file, import manually
    update_status("In Progress", "Starting Inserts");
    $query_base = "INSERT INTO `imdb_ratings` (`imdbid`, `rating`, `votes`) VALUES ";
    $update_threshold = 100000;
    $current_threshold = $update_threshold;
    for ($i = 1; $i < $total;) // First row is headers
    {
        $inner = 0;
        $extended = array();
        for (; $i < $total && ($inner == 0 || $i % 1000 !== 0); ++$inner, ++$i)
        {
            $row = $rows[$i];
            $entry = explode("\t", $row);
            $id = (int)substr($entry[0], 2);
            $rating = (int)((double)($entry[1]) * 10);
            $votes = (int)$entry[2];
            $extended[] = "($id, $rating, $votes)";
        }

        $query = $query_base . implode(", ", $extended);
        
        if (!$db->query($query))
        {
            update_status("Failed", "Could not update rows: $db->error");
            die();
        }


        if ($i % 100000 == 0)
        {
            $percent = round(($i * 100) / $total, 2);
            $time = round(microtime(TRUE) - $start, 2);
            update_status("In Progress", "Processed $i of $total records (" . $percent . "%) in " . $time . " seconds");
        }
    }
}

if (!$db->commit() || !$db->autocommit(TRUE))
{
    update_status("Failed", "Could not commit changes: $db->error");
    die();
}

update_status("Success", date(DateTimeInterface::ISO8601) . " - Completed $total records in " . round(microtime(TRUE) - $start, 2) . " seconds");
?>

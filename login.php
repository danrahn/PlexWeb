<?php

session_start();

require_once "includes/common.php";
requireSSL();

if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === TRUE)
{
	header("location: index.php");
	exit;
}
?>


<html>
<head>
	<meta http-equiv="Content-Type" content="text/html;charset=ISO-8859-1">
	<link rel="stylesheet" type="text/css" href="style.css">
	<link rel="shortcut icon" href="favicon.ico">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#3C5260" />
	<script src="resource/min/animate.min.js"></script>
	<script src="resource/consolelog.js"></script>
	<title>Plex Status: Login</title>
</head>
<body>

<div id="plexFrame">
	<div id="container">
		<div id="login" class="formContainer">
			<div id="formTitle">Login (<a href="register.php">register</a>)</div>
			<form id="loginForm" action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']) ?>" method="POST">
				<div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
				<hr />
				<div class="formInput"><label for="password">Password: </label><input type="password" name="password" id="password"></div>
				<hr />
				<div class="formInput"><input type="button" value="submit" id="go"></input></div>
			</form>
		</div>
		<div id="formStatus" class="formContainer"></div>
	</div>
</div>
<script>

window.addEventListener('load', function() {
	setupLoginForm();
});

/// <summary>
/// Setup event handlers for the suggestion form
/// </summary>
function setupLoginForm()
{
	let user = document.querySelector("input[name='username']");
	let pass = document.querySelector("input[name='password']");
	
	document.getElementById("go").addEventListener("click", function() {
		let user = document.querySelector("input[name='username']");
		let pass = document.querySelector("input[name='password']");
		// Infallible client-side validation
		if (!user.value) {
			Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, user, 500);
			Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, user, 500, 500);
		}

		if (!pass.value) {
			Animation.queue({"backgroundColor" : new Color(140, 66, 69)}, pass, 500);
			Animation.queueDelayed({"backgroundColor" : new Color(100, 66, 69)}, pass, 500, 500);
		}

		if (!user.value || !pass.value) {
			return;
		}

		var http = new XMLHttpRequest();
		http.open("POST", "process_request.php", true /*async*/);
		http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		http.onreadystatechange = function() {
			if (this.readyState != 4 || this.status != 200) {
				return;
			}

			try {
				let response = JSON.parse(this.responseText);
				logJson(response, LOG.Info);
				let status = document.getElementById("formStatus");
				if (response["Error"]) {
					status.className = "formContainer statusFail";
					status.innerHTML = response["Error"];
					Animation.queue({"opacity" : 1}, status, 500);
					Animation.queueDelayed({"opacity" : 0}, status, 5000, 1000);
					return;
				}

				window.location = "index.php";
			} catch (ex) {
				logError(ex);
				logError(this.responseText);
			}
		};
		
		http.send(`&type=login&username=${user.value}&password=${pass.value}`);
		
	});
	
	var inputs = document.querySelectorAll("input, select");
	for (var i = 0; i < inputs.length; i++) {
		inputs[i].addEventListener("keyup", function(e) {
			if (e.keyCode === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
				document.getElementById("go").click();
			}
		});
	}
	
	user.addEventListener("focusout", focusOutEvent);
	pass.addEventListener("focusout", focusOutEvent);
	document.querySelector("input[type='button']").addEventListener("focusout", focusOutEvent);
	
	user.addEventListener("focus", focusInEvent);
	pass.addEventListener("focus", focusInEvent);
	document.querySelector("input[type='button']").addEventListener("focus", focusInEvent);

	user.focus();
}

/// <summary>
/// If a suggestion form box is required and is empty when it loses
/// focus, change the background color to indicate the error
/// </summary>
function focusOutEvent() {
	if (!this.value) {
		this.style.backgroundColor = "rgb(100, 66, 69)";
		return;
	}
}

/// <summary>
/// When a suggestion input is selected, highlight the border and clear
/// any background formatting
/// </summary>
function focusInEvent() {
	this.style.backgroundColor = "rgb(63, 66, 69)";
}
</script>
</body>
</html>
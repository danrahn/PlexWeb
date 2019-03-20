<style>
#nav {
	width: 100%;
	height: 40px;
	background-color: #2E5E3E;
	opacity: 0.8;
	position: fixed;
	left: 0;
	top: 0;
}

#nav button {
	height: 100%;
	background-color: #2E5E3E;
	color: #C1C1C1;
	font-weight: bold;
	padding-left: 15px;
	padding-right: 15px;
	border: none;
}

#nav .leftbutton {
	border-right: 2px solid #808080;
	float: left;
}

#nav .rightbutton {
	border-left: 2px solid #808080;
	float: right;
}

#navholder button:hover, #mainMenu:hover {
	background-color: #0E3E1E;
}

.ham {
	width: 30px;
	height: 3px;
	background-color: #c1c1c1;
	margin-top: 8px;
}

#mainMenu {
	height: 40px;
	padding: 0 10px;
	margin: auto;
}

#leftMenu {
	background-color: rgb(46, 94, 62);
	color: #C1C1C1;
	width: 150px;
	height: calc(100vh - 40px);
	position: absolute;
	top: 40px;
	left: -150px;
}

#leftMenu button {
	height: 35px;
	width: 100%;
	background-color: transparent;
	color: #C1C1C1;
	font-weight: bold;
	padding-left: 15px;
	padding-right: 15px;
	border: none;
	font-size: 12pt;
	line-height: 35px;
	border-bottom: 2px solid #808080;
}

.btnimg {
	float: left;
}

.btntxt {
	float: right;
}

#pageName {
	color: #c1c1c1;
	float: left;
	display: inline-block;
	vertical-align: center;
	line-height: 40px;
	padding: 0 10px;
	font-size: 14pt;
}
</style>
<div id="navholder">
<div id="nav">
	<div id="mainMenu" class="leftbutton">
		<div class="ham"></div>
		<div class="ham"></div>
		<div class="ham"></div>
	</div>
	<button class="rightbutton" onclick="window.location = 'logout.php'">
		<div class=btnimg><image src='resource/logout.png' alt='Logout' height=24px style='filter: invert(80%);margin-top:3px'/></div>
	</button>
	<button class="rightbutton"onclick="window.location = 'view_requests.php'">
		<div class=btnimg><image src='resource/requests.png' alt='Requests' height=24px style='filter: invert(80%);margin-top:3px'/></div>
	</button>
	<button class="rightbutton" onclick="window.location = 'user_settings.php'">
		<div class=btnimg><image src='resource/settings.png' alt='Settings' height=24px style='filter: invert(80%);margin-top:3px'/></div>
	</button>
	<div id="pageName" onclick="window.location = 'index.php'">Plex Web</button>
</div>
<div id="leftMenu">
	<button onclick="window.location = 'index.php'">
		<div class=btnimg><image src='resource/home.png' alt='Home' height=24px style='filter: invert(80%);margin-top:3px'/></div>
		<div class=btntxt>Home</div>
	</button>
<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) { ?>
	<button onclick="window.location = 'members.php'">
		<div class=btnimg><image src='resource/members.png' alt='Home' height=24px style='filter: invert(80%);margin-top:3px'/></div>
		<div class=btntxt>Members</div>
	</button>
<?php } ?>
	<button class="rightbutton" onclick="window.location = 'user_settings.php'"><div class=btnimg><image src='resource/settings.png' alt='Settings' height=24px style='filter: invert(80%);margin-top:3px'/></div><div class=btntxt>Settings</div></button>
	<button onclick="window.location = 'view_requests.php'">
		<div class=btnimg><image src='resource/requests.png' alt='Requests' height=24px style='filter: invert(80%);margin-top:3px'/></div>
		<div class=btntxt>Requests</div>
	</button>
	<button onclick="window.location = 'logout.php'">
		<div class=btnimg><image src='resource/logout.png' alt='Logout' height=24px style='filter: invert(80%);margin-top:3px'/></div>
		<div class=btntxt>Logout</div>
	</button>
</div>
</div>
<script>
	document.getElementById("mainMenu").addEventListener("click", function() {
		let menu = document.getElementById("leftMenu");
		if (menu) {
			if (menu.style.opacity == "1") {
				Animation.queue({"opacity" : 0, "left": "-150px"}, menu, 200);
			} else {
				Animation.queue({"opacity" : 1, "left" : "0px"}, menu, 200);
			}
		}
	});

	window.addEventListener("keydown", function(e) {
		e = e || window.event;
		const key = e.which || e.keyCode;
		if (key === 27 /*esc*/) {
			let menu = document.getElementById("leftMenu");
			if (menu && menu.style.opacity != 0) {
				Animation.queue({"opacity" : 0, "left": "-150px"}, menu, 200);
			}
		}
	});

	window.addEventListener("click", function(e) {
		e = e || window.event;
		let element = e.target;
		let parent = element;
		while (parent) {
			if (parent.id == 'leftMenu') {
				return;
			}
			parent = parent.parentNode;
		}

		let menu = document.getElementById("leftMenu");
		if (menu && menu.style.opacity != 0) {
			Animation.queue({"opacity" : 0, "left": "-150px"}, menu, 200);
		}

	})
</script>
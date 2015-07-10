var game = new Phaser.Game(750, 750, Phaser.AUTO);

//Player variables
var player = 0;		//Player sprite
var health = 5;	//Health level
var hp = [0, 1, 2, 3, 4];	//Sprites for health point levels of bar 
var immune = false;	//Can player be hit?
var immune_timer = 0;	//How long player is immune
var blink_timer = 0;	//How often player sprite blinks when immune
var anim_playing = false;	//Check if "run" animation is playing
var punch_key = 0;	//Key for punching [spacebar]
var punching = false	//Is player punching?
var fist = 0;	//Fist sprite (for punching)
var punch_length = 0;	//Where fist should reach to when punching
var speed = 0;	//Player speed (x / horizontal)
var dead = false;	//Is player (in game) dead?
var restart_key = 0;	//Key for restarting after game over [R]
var snd_hit = 0;	//Sound for hitting zombie
var snd_playerHit = 0; 	//Sound for when player is hit (in game)
var music = 0;	//Background music
var music_off = true;	//Has music been turned off by player?
var music_key = 0;	//Key to start/stop music
var pick_key = 0;	//Key to pick up zombie (and throw)

//World variables
var cursors = 0;	//Arrow keys input 
var map = 0;	//Tilemap
var layer = 0;	//Tilemap tile layer
var emitter = 0;	//Particle effect emitter for destroying blocks
var zombies = 0;	//Zombies group
var spikes = 0;	//Spikes group
var game_over = 0;	//"game over" sprite message

//State to preload game assets
var preload = function (game) {};
preload.prototype = {
	preload: function () {
		//Preload assets
		this.game.load.spritesheet("player", "assets/images/player.png", 12, 28);
		this.game.load.image("hp_1", "assets/images/hp-1.png");
		this.game.load.image("hp_2", "assets/images/hp-2.png");
		this.game.load.spritesheet("player_dead", "assets/images/player-dead.png", 24, 28);
		this.game.load.tilemap("1", "assets/tilemaps/blockpunch-1.json", null, Phaser.Tilemap.TILED_JSON);
		this.game.load.image("blocks", "assets/images/block.png");
		this.game.load.image("blockC_left", "assets/images/blockC-left.png");
		this.game.load.image("blockC_right", "assets/images/blockC-right.png");
		this.game.load.spritesheet("zombie", "assets/images/zombie.png", 12, 28);
		this.game.load.image("zombie_dazed", "assets/images/zombie-dazed.png");
		this.game.load.image("spike", "assets/images/spike.png");
		this.game.load.image("fist", "assets/images/fist.png");
		this.game.load.image("game_over", "assets/images/game-over.png");
		this.game.load.audio("hit", "assets/sounds/hit.wav");
		this.game.load.audio("music", "assets/sounds/music.wav");
		this.game.load.audio("player_hit", "assets/sounds/player-hit.wav");
	},
	create: function () {
		//Launch game
		this.game.state.start("main");
	}
};

//Main game state
var main = function (game) {};
main.prototype = {
	create: function () {
		this.game.physics.startSystem(Phaser.Physics.ARCADE);
		this.game.stage.backgroundColor = 0x222034;

		player = this.game.add.sprite(0, 0, "player");
		player.anchor.setTo(0.5, 0.5);
		player.animations.add("run");

		this.game.physics.arcade.enable(player);
		player.body.collideWorldBounds = true;
		player.body.gravity.y = 1000;

		//Health bar
		for (x=0; x<hp.length; x++) {
			if (x == 0) hp[x] = this.game.add.sprite((295 + (x * 48)), 25, "hp_1");
			else if (x == 4) {
				hp[x] = this.game.add.sprite((295 + (x * 48)), 25, "hp_1");
				hp[x].scale.x = -1;
			}
			else hp[x] = this.game.add.sprite((295 + (x * 48)), 25, "hp_2");

			hp[x].anchor.setTo(0.5, 0.5);
			hp[x].fixedToCamera = true;
		}

		punch_key = this.game.input.keyboard.addKey(Phaser.Keyboard.C);
		punch_key.onDown.add(function () {if (!punching) this.punch();}, this);

		pick_key = this.game.input.keyboard.addKey(Phaser.Keyboard.X);
		pick_key.onDown.add(this.pick_zombie, this);

		restart_key = this.game.input.keyboard.addKey(Phaser.Keyboard.R);
		restart_key.onDown.add(function () {this.game.state.start(this.game.state.current); dead = false; health = 5;}, this)

		snd_hit = this.game.add.audio("hit");
		snd_playerHit = this.game.add.audio("player_hit");
		//Only instantiate music once
		if (music == 0) music = this.game.add.audio("music");

		if (!music.isPlaying && !music_off) music.play("", 0, 0.5, true);

		music_key = this.game.input.keyboard.addKey(Phaser.Keyboard.M);
		music_key.onDown.add(function () {
			if (music.isPlaying) {
				music.pause(); 
				music_off = true; 
			}
			else {
				music.play("", 0, 0.5, true); 
				music_off = false;
			}
		});

		map = this.game.add.tilemap("1");
		map.addTilesetImage("blocks");
		map.addTilesetImage("blockC_left");
		map.addTilesetImage("blockC_right");
		map.addTilesetImage("spike");

		map.setCollisionBetween(1, 5);

		layer = map.createLayer("Tile Layer 1");
		layer.resizeWorld();
		
		zombies = this.game.add.group();
		zombies.enableBody = true;

		spikes = this.game.add.group();
		spikes.enableBody = true;

		map.createFromObjects("Object Layer 1", 4, "zombie", 0, true, false, zombies);
		this.game.physics.arcade.enable(zombies);
		for (x=0; x<zombies.children.length; x++) {
    		zombies.getChildAt(x).body.gravity.y = 1000;

    		zombies.getChildAt(x).anchor.setTo(0.5, 0.5);
    		zombies.getChildAt(x).animations.add("run");
    	}

    	map.createFromTiles(7, null, "spike", layer, spikes);

		//Set up keyboard input
		cursors = this.game.input.keyboard.createCursorKeys();

		this.game.camera.follow(player);

		//Instantiate fist sprite (to later be positioned when punching)
		//We add this sprite after handling the tilemap, so it is placed over it
		fist = this.game.add.sprite(-500, -500, "fist");
		fist.anchor.setTo(0.5, 0.5);
		this.game.physics.arcade.enable(fist);
	},
	update: function () {
		//Handle collisions
		this.game.physics.arcade.collide(player, layer);
		//Kill player when colliding with zombies or spikes
		//Only collide if !dead because if dead and zombie still colliding with player, animation does not play (probably because it keeps on resetting)
		if (!dead && !immune) this.game.physics.arcade.collide(player, zombies, this.hit);
		if (!dead) this.game.physics.arcade.collide(player, spikes, this.hitSpike);
		this.game.physics.arcade.collide(zombies, layer);
		this.game.physics.arcade.collide(zombies, zombies);
		//Collide fist with zombies to kill zombies
		//We want this for every zombie (in group "zombies"), so we cycle through the group's children to check each individual child
		for (x=0; x<zombies.children.length; x++) {
			this.game.physics.arcade.collide(fist, zombies.getChildAt(x), this.hit_zombie);
		}

		//**Player movement**
		if (!dead) player.body.velocity.x = speed;

		//Change player vel (var "speed") with input
		if (!dead) {
			if (cursors.left.isDown) {
				if (speed > -500) speed -= 30;
				player.scale.x = -1;
			}
			else if (cursors.right.isDown) {
				if (speed < 500) speed += 30;
				player.scale.x = 1;
			}
    		else {
    			if (speed > 0) speed -= 30
    			else if (speed < 0) speed += 30
    		}

    		if (cursors.up.isDown && player.body.blocked.down) {
        		player.body.velocity.y = -550;
    		}
    	}

    	//Handle player animation (play "run" when moving, i.e. if velocity.x > 0 when moving right or < 0 when moving left) (blink when immune)
    	if (!dead) {
    		if (player.body.velocity.x > 0 || player.body.velocity.x < 0) player.animations.play("run", 20, true);
    		else player.animations.stop(null, true);
    	}

    	if (immune) {
    		blink_timer = this.game.time.events.add(75, function () {if (player.alpha == 1) player.alpha = 0; else player.alpha = 1;}, this);
    	}
    	else {
    		if (blink_timer.running) {
    			blink_timer.destroy();
    		}
    		if (immune_timer.running) immune_timer.destroy();
    		//Sometimes player is still alpha 0 when not immune; make sure they are always 1
    		player.alpha = 1;
    	}
    	//******************************

    	//**Zombie movement**
    	//Slow down after pushed and moving (don't keep moving forever)
    	//We want this for every zombie (in group "zombies"), so we cycle through the group's children to modify properties of each individual child
    	for (x=0; x<zombies.children.length; x++) {
    		if (zombies.getChildAt(x).body.velocity.x > 0) zombies.getChildAt(x).body.velocity.x -= 10;
    		else if (zombies.getChildAt(x).body.velocity.x < 0) zombies.getChildAt(x).body.velocity.x += 10;
    	}

    	//Zombie AI
    	this.ai_zombie();
    	//*******************

    	//Update health bar
    	for (x=0; x<hp.length; x++) {
    		if ((4 - health) == x) {
    			hp[x].body = null;
				hp[x].destroy();
    		}
    	}

    	if (punching) this.punch();
	},
	ai_zombie: function () {
		//We want this for every zombie (in group "zombies"), so we cycle through the group's children to modify properties of each individual child
		for (x=0; x<zombies.children.length; x++) {
			if (!dead) {
				//Movement
				//Are zombies alerted, i.e. have already moved towards player?
				if (!zombies.getChildAt(x).alerted) {
					//<No>
					//Is player to right of zombie in appropriate distance?
					if (zombies.getChildAt(x).position.x > player.position.x && (zombies.getChildAt(x).position.x - player.position.x) <= 600 && !zombies.getChildAt(x).dazed) {
						if (zombies.getChildAt(x).body.velocity.x > -600) zombies.getChildAt(x).body.velocity.x -= 30;
						zombies.getChildAt(x).scale.x = 1;
						zombies.getChildAt(x).stopped = false;
						//Now they are alerted
						zombies.getChildAt(x).alerted = true;
					}
					//Is player to left of zombie in appropriate distance?
					else if (zombies.getChildAt(x).position.x < player.position.x && (player.position.x - zombies.getChildAt(x).position.x) <= 600 && !zombies.getChildAt(x).dazed) {
						if (zombies.getChildAt(x).body.velocity.x < 600) zombies.getChildAt(x).body.velocity.x += 30;
						zombies.getChildAt(x).scale.x = -1;
						zombies.getChildAt(x).stopped = false;
						//Now they are alerted
						zombies.getChildAt(x).alerted = true;
					}
					else zombies.getChildAt(x).stopped = true;
				}
				else {
					//<Yes>
					if (zombies.getChildAt(x).position.x > player.position.x && !zombies.getChildAt(x).dazed) {
						if (zombies.getChildAt(x).body.velocity.x > -600) zombies.getChildAt(x).body.velocity.x -= 30;
						zombies.getChildAt(x).scale.x = 1;
					}
					else if (zombies.getChildAt(x).position.x < player.position.x && !zombies.getChildAt(x).dazed) {
						if (zombies.getChildAt(x).body.velocity.x < 600) zombies.getChildAt(x).body.velocity.x += 30;
						zombies.getChildAt(x).scale.x = -1;
					}
					else {	//If zombie dazed
						if (zombies.getChildAt(x).body.velocity.x == 0) {	//Check if zombie is not still flying back after being hit (i.e., is meant to be stationary and dazed)
							//For some reason, collision with fist only occurs when zombie moving towards it
							if (player.position.x > zombies.getChildAt(x).position.x) zombies.getChildAt(x).body.velocity.x = 0.1;
							else zombies.getChildAt(x).body.velocity.x = -0.1;
						}
					}
				}
			}

			//Movement animation
			if (!dead) {
				if(!zombies.getChildAt(x).dazed) {
					//Reload default zombie texture when zombie is no longer dazed after being dazed
					if (zombies.getChildAt(x).hasBeenDazed && )
					zombies.getChildAt(x).loadTexture("zombie");
					if (!zombies.getChildAt(x).stopped) zombies.getChildAt(x).animations.play("run", 20, true);
					else zombies.getChildAt(x).animations.stop(null, true);
				}
				else zombies.getChildAt(x).loadTexture("zombie_dazed");
			}
			else {
				//Stop zombie animations if player dead
				zombies.getChildAt(x).animations.stop(null, true);
				zombies.getChildAt(x).body.velocity.x = 0;
			}

			//Dazed timer
			if (zombies.getChildAt(x).dazed && typeof zombies.getChildAt(x).dazed_timer == "undefined") {
				//Add dazed timer
				//this.game.time.events.add does not work here for some reason
				zombies.getChildAt(x).dazed_timer = this.game.time.events.add(Phaser.Timer.SECOND * 2, this.stop_daze, this, zombies.getChildAt(x));
			}
		}
	},
	punch: function () {
		if (!punching && player.scale.x == 1) {
			fist.position.x = player.position.x + 40;
			punch_length = player.position.x + 100;
			fist.scale.x = 1;
		}
		else if (!punching && player.scale.x == -1) {
			fist.position.x = player.position.x - 40;
			punch_length = player.position.x - 100;
			fist.scale.x = -1;
		}
		fist.position.y = player.position.y - 5;
		punching = true;

		if (fist.position.x < punch_length) fist.position.x += 5;
		else if (fist.position.x > punch_length) fist.position.x -= 5; 
		else {
			punching = false;
			fist.position.x = -500;
			fist.position.y = -500;
		}
	},
	//Stop zombie being dazed
	stop_daze: function (z) {
		z.dazed = false;
	},
	//Pick up zombie
	pick_zombie: function () {

	},
	hit_zombie: function (f, z) {
		snd_hit.play();	//Play "hit zombie" sound
		//Which side is zombie on in relation to player?
		//When already dazed, zombies seem to fly through walls when colliding with them. No punching dazed zombies
		if (!z.dazed && !z.hasBeenDazed) {
			if (z.position.x > player.position.x) z.body.velocity.x = 1000;
			else z.body.velocity.x = -1000;
			z.body.velocity.y = -500;
			z.dazed = true;
			z.hasBeenDazed = true;
		}
		else if (z.hasBeenDazed || z.dazed) {	//If zombie has been dazed or is currently dazed, kill it
			z.body = null;
			z.destroy();
		}

		fist.x = -500;
		fist.y = -500;
		fist.body.velocity.x = 0;
		fist.body.velocity.y = 0;
		punch_length = 0;
		punching = false;
	},
	hit: function () {
		if (health > 1) {
			health--;
			snd_playerHit.play();	//Play sound effect
			//Become immune for 1 seconds 
			immune = true;
			//"this.game.time.events.add" does not work here for some reason
			immune_timer = game.time.events.add(Phaser.Timer.SECOND, function () {immune = false;}, this);

		}
		else {
			//Game over
			//Remove last health bar part (doesn't go away unless we remove it here)
			hp[4].body = null;
			hp[4].destroy();
			snd_playerHit.play();	//Play sound effect
			dead = true;
			player.loadTexture("player_dead", 0);
			player.animations.add("die");
			player.animations.play("die", 20, false);
			player.body.velocity.x = 0;

			//"this.game.add.sprite" does not work here for some reason
			game_over = game.add.sprite(400, 200, "game_over");
			game_over.anchor.setTo(0.5, 0.5);
			game_over.fixedToCamera = true;
		}
	},
	hitSpike: function () {
		health = 0;

		//Calling "this.hit()" for Game Over doesn't work for some reason 
		//Game over
		//Remove all health bar parts (don't go away unless we remove them here)
		for (x=0; x<hp.length; x++) {
			hp[x].body = null;
			hp[x].destroy();
		}
		snd_playerHit.play();	//Play sound effect
		dead = true;
		player.loadTexture("player_dead", 0);
		player.animations.add("die");
		player.animations.play("die", 20, false);
		player.body.velocity.x = 0;

		//"this.game.add.sprite" does not work here for some reason
		game_over = game.add.sprite(400, 200, "game_over");
		game_over.anchor.setTo(0.5, 0.5);
		game_over.fixedToCamera = true;
	}
}

game.state.add("preload", preload);
game.state.add("main", main);
game.state.start("preload");


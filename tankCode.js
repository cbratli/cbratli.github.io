importScripts('lib/tank.js');


/*
* TODO: 
* Find smart ways to make it smarter :-)
* Turn radar even tough we have an enemy in front of us. (Then simulate the enemies most likely new position.)
* Smarter dodging / escaping from enemies that are close 
* Find size of bot so we can dodge bullets
* 
* Use radio to cooperate.
* a) Send enemies to other bots
* b) 
*/
var isDebugEnvironment = true;
// To be able to run in my owns simulator
if (typeof debugCanvas1 == 'undefined') {
  // the variable is defined
  var debugCanvas1 = {}
  debugCanvas1.height = 200;
  debugCanvas1.width = 400;
  context = {};
  context.filleStyle = "";
  context.fillRect = function(a,b,c,d) {};
  console.log("Canvas was undefined")
  isDebugEnvironment = false;
}

var PROPS = {};

PROPS.TANK_SIZE_X = 35;  // GameEngine also uses this, so we can control it here.
PROPS.TANK_SIZE_Y = 10
PROPS.BULLET_SIZE_X = 8;
PROPS.BULLET_SIZE_Y = 4;


PROPS.GUN_SPEED_DEG = 3;
PROPS.TURN_SPEED_DEG = 2;
PROPS.BULLET_VELOCITY = 4;
PROPS.RADAR_SPEED_DEG = 6;

PROPS.VERTICAL_LEFT_WALL = 0;
PROPS.HORIZONTAL_TOP_WALL = 1;
PROPS.VERTICAL_RIGHT_WALL = 2;
PROPS.HORIZONTAL_BOTTOM_WALL = 3;

INIT = {};
INIT.mainLoop = true;
INIT.radarEnemy = true;
INIT.radarWall = true;
INIT.radarBullet = true;

DEG2RAD = Math.PI/180.0;
RAD2DEG = 180.0/Math.PI;

playGroundSizeX = 850;
playGroundSizeY = 550;

var prevStateWall;
var prevStateEnemy;
var prevControl;
var prevStateBullet;
var simulationStep = 0;
var enemyAngle = null;
var information = null
var DYNAMIC_PROPS = {};
DYNAMIC_PROPS.WALL = [0,0,0,0];
DYNAMIC_PROPS.enemyNotSeenCounter = 0;
DYNAMIC_PROPS.WALL_STATUS = [0,0,0,0];
DYNAMIC_PROPS.enemy = {}
DYNAMIC_PROPS.prevEnemy = {}
DYNAMIC_PROPS.simulatedEnemy = {}  // All seen enemies will be simulated inside here :-)
DYNAMIC_PROPS.simulatedEnemyProps = {}
DYNAMIC_PROPS.lastSeenEnemy = null
hitEnemy = {};
hitEnemy.backSteps = 0;
hitEnemy.boostSteps = 0;

globalControl = null;
bullets = {}

class UpDownCounter
{
  constructor(lowCount, highCount, stepSize, initialValue=0) {
    this.lowCount = lowCount;
    this.highCount = highCount;
    this.value = initialValue;
    this.valueToAdd = stepSize;
  }
  
  count() 
  {
    this.value += this.valueToAdd;
    if (this.value > this.highCount ||
       this.value < this.lowCount) { 
      this.valueToAdd = -this.valueToAdd;
    }
    return this.value;
  }
  
  getCurrentValue() {
  	return this.value;
  }
}



tank.init(function(settings, info) {
	// initialize tank here
    init(settings,info);
});

function init(settings,info)
{
    settings.SKIN = 'lava'
    information = info;
    DYNAMIC_PROPS.aimBias = new UpDownCounter(-30, 30, 3);
  
}

function sign(value)
{
  if (value > 0){ return 1};
  return -1;
}

/*
* Calculates if the robot is driving forward or in reverse
* return  1 if forward
* return -1 if reverse
*/
function getSpeedDirectionEnemy(enemy, prevEnemy)
{
  
   	if (sign(Math.cos(enemy.angle*DEG2RAD)) !== sign(enemy.x - prevEnemy.x))
    {
    	return -1;
    }
   
    if (sign(Math.sin(enemy.angle*DEG2RAD)) !== sign(enemy.y - prevEnemy.y))
    {
    	return -1;
    } 
  	return 1;
}


function storeEnemyInformation(state, simulationStep) {
  if (state.radar.enemy)  
  {
    	enemy = state.radar.enemy;
    	enemy.simulationStep = simulationStep
    	var enemyName = state.radar.enemy.id;
    	DYNAMIC_PROPS.lastSeenEnemy = enemyName;
      if (!DYNAMIC_PROPS.enemy.hasOwnProperty(enemyName)){
        console.log("FOUND A NEW ENEMY")
				// This is the first time we see this enemy, create empty simulatedEnemyProps

        enemyProps = {}
        enemyProps.deltaAngle = [];
        enemyProps.deltaSpeed = [];
        enemyProps.speedDirection = [];        
        DYNAMIC_PROPS.simulatedEnemyProps[enemyName] = enemyProps;
        DYNAMIC_PROPS.enemy[enemyName] = enemy;
      }

    
		// Store the new enemy.
    DYNAMIC_PROPS.prevEnemy[enemyName] = DYNAMIC_PROPS.enemy[enemyName];
    DYNAMIC_PROPS.enemy[enemyName] = enemy;
  }
}

function simulationStepEnemyInformation(state, simulationStep) {
  for (enemyName in DYNAMIC_PROPS.enemy)
  {    
        // Check timeDifference
        var deltaSim = Math.max(1,DYNAMIC_PROPS.enemy[enemyName].simulationStep - DYNAMIC_PROPS.prevEnemy[enemyName].simulationStep); 
        var deltaAngle = (DYNAMIC_PROPS.enemy[enemyName].angle - DYNAMIC_PROPS.prevEnemy[enemyName].angle)/Math.max(deltaSim,1); 
        var deltaSpeed = (DYNAMIC_PROPS.enemy[enemyName].speed - DYNAMIC_PROPS.prevEnemy[enemyName].speed)/Math.max(deltaSim,1); 
        var speedDirection = getSpeedDirectionEnemy(DYNAMIC_PROPS.enemy[enemyName], DYNAMIC_PROPS.prevEnemy[enemyName]);
       
    		if (deltaSim < 60)
        {
        	// Store information to be used about the enemy.
          DYNAMIC_PROPS.simulatedEnemyProps[enemyName].deltaAngle.push(deltaAngle);
          DYNAMIC_PROPS.simulatedEnemyProps[enemyName].deltaSpeed.push(deltaSpeed);
          DYNAMIC_PROPS.simulatedEnemyProps[enemyName].speedDirection.push(speedDirection);   
        }
    
    if (DYNAMIC_PROPS.enemy[enemyName].simulationStep == simulationStep) {
    	// We just got a new snapshot of the enemy, copy that to the simulatedEnemy
      DYNAMIC_PROPS.simulatedEnemy[enemyName] = DYNAMIC_PROPS.enemy[enemyName];
       return;
    }
		// Do a simulation step, since we dont have a measurement of the enemy.
    // Here we will do a simulationstep, and store the new enemy position.
      
    enemy = DYNAMIC_PROPS.simulatedEnemy[enemyName];
    speed = enemy.speed*speedDirection;
    
    if (pointIsInsidePlayArea(enemy)) 
    {
    enemy.angle = Math.deg.normalize(enemy.angle + deltaAngle);
    enemy.x +=  Math.cos(enemy.angle*DEG2RAD)*speed
    enemy.y +=  Math.sin(enemy.angle*DEG2RAD)*speed
    DYNAMIC_PROPS.simulatedEnemy[enemyName] = enemy;
     }
  }
}



function simulationStepForBullets() 
{
for(var key in bullets) {
  	    var bullet1 = bullets[key];
        bullet1.x +=  Math.cos(bullet1.angle*DEG2RAD)*bullet1.speed
      	bullet1.y +=  Math.sin(bullet1.angle*DEG2RAD)*bullet1.speed
       if (!pointIsInsidePlayArea(bullet1)) 
       {
         delete bullets[key];
         console.log("DELETED BULLET")
       }
     }
}

function getXYFromTwoBullets(state)
{
  // For testing purpose, we only use two bullets that have an angle of 3 degrees difference.
  if (state.radar.bullets.length > 0)
  {
    // Add all bullets.
    for (var i = 0; i < state.radar.bullets.length; i++) {
    	bullets[state.radar.bullets[i].id] = state.radar.bullets[i];
    }
        
    // Check if the new bullet is close to another bullet. (use angle for now.)
    newBullet = state.radar.bullets[0]
    otherBullet = null;
    for(var key in bullets) {
  	  var b = bullets[key];
    
    // Two bullets right after each other.
    if ( Math.abs( Math.deg.normalize(b.angle - newBullet.angle)) < 4 ) 
    {
    	if (Math.abs( Math.deg.normalize(b.angle - newBullet.angle)) > 0) {
      	otherBullet = b;
        console.log("Found a bullet match")
      }
    }
  }
    
    if (otherBullet !== null) 
    {
      bullet1 = {}
      bullet1.x = newBullet.x;
      bullet1.y = newBullet.y;
      bullet1.angleRad = Math.deg.normalize(newBullet.angle - 180)*DEG2RAD
      bullet1.speed = newBullet.speed;
            
      bullet2 = {};
      bullet2.x = otherBullet.x;
      bullet2.y = otherBullet.y;
      bullet2.angleRad = Math.deg.normalize(otherBullet.angle - 180)*DEG2RAD
      bullet2.speed = otherBullet.speed;
      
      dist = 100000;
      prevDist = dist + 1;
 
      keepOnSimulating = true;
      while (dist < prevDist && keepOnSimulating) 
      {
      	bullet1.x +=  Math.cos(bullet1.angleRad)*bullet1.speed
      	bullet1.y +=  Math.sin(bullet1.angleRad)*bullet1.speed

       	bullet2.x +=  Math.cos(bullet2.angleRad)*bullet2.speed
      	bullet2.y +=  Math.sin(bullet2.angleRad)*bullet2.speed

        keepOnSimulating = pointIsInsidePlayArea(bullet1);
        prevDist = dist;
        
        dist = Math.pow((bullet1.x-bullet2.x),2) + Math.pow((bullet1.y-bullet2.y),2)
      }
      
       if (dist > 40) {return null;}
           
 		return {
        x: (bullet1.x + bullet2.x)/2.0,
        y: (bullet1.y + bullet2.y)/2.0
    };      
    }
  }
  return null;  
}

function pointIsInsidePlayArea(point) 
{
  keepOnSimulation = true;
  keepOnSimulation = keepOnSimulation & (point.y < DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL]);
  keepOnSimulation = keepOnSimulation & (point.y > DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL]);
  keepOnSimulation = keepOnSimulation & (point.x < DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL]);
  keepOnSimulation = keepOnSimulation & (point.x > DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL]);
	return keepOnSimulation;
}

function getXYFromBullets(state)
{
if (state.radar.bullets.length > 0)
  
  bullet = {}
  bullet.x = state.radar.bullets[0].x;
  bullet.y = state.radar.bullets[0].y;
  bullet.angleRad = Math.deg.normalize(state.radar.bullets[0].angle + 180)*DEG2RAD;
  bullet.simSteps = 0;
      
  keepOnSimulation = true;
  speed = 30.0; // Dummy speed to reduce simulation time.
  while(keepOnSimulation) {
      bullet.simSteps++;
      bullet.y =  bullet.y+Math.sin( bullet.angleRad )*speed;
      bullet.x =  bullet.x+Math.cos( bullet.angleRad )*speed;
      keepOnSimulation = pointIsInsidePlayArea(bullet) 
  }
  // And one simulationstep back
   bullet.y =  bullet.y-Math.sin( bullet.angleRad )*speed;
   bullet.x =  bullet.x-Math.cos( bullet.angleRad )*speed;
  
  return bullet;
}

function updateWallInfromationFromMessage(message)
{
	if (message.DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] < DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] ) 
    {
      DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] = message.DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL];
      DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_BOTTOM_WALL] = 1;
    }
    
    if (message.DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] > DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] ) 
    {
      DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] = message.DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL]; 
      DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_TOP_WALL] = 1;
    }
    
    if (message.DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] < DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] ) 
    {
      DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] = message.DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL];
      DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_RIGHT_WALL] = 1;
    }

    if (message.DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] > DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] ) 
    {
      DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] = message.DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL];
      DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_LEFT_WALL] = 1;
    }
}

function turnGunToAngleIfNoEnemyIsSeen(state,newAngle)
{
 if (state.radar.enemy === null) {
   diffAngle = Math.deg.normalize(enemyAngle - newAngle);
   		
   		if (Math.abs(diffAngle) > 90) {
    	  enemyAngle = newAngle;
      }
    }
}
  
function turnAroundIfCloseToWall(state, control, myDir)
{
  goesRight = state.angle < 90 && state.angle > -90;
  goesUp = state.angle < 0;
  
  if (myDir < 0) {
    goesRight = !goesRight;
    goesUp = !goesUp;
  }  
  turn_distance = 200;
  if (state.x + turn_distance > DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] && goesRight === true) 
  {
  	control.TURN = myDir;
    //turnGunToAngleIfNoEnemyIsSeen(state,180);
    console.log("WILL TURN")
  }
  
  if (state.x - turn_distance < DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] && goesRight === false) 
  {
    control.TURN = myDir;
    console.log("WILL TURN")
    //turnGunToAngleIfNoEnemyIsSeen(state,0);
  }
  
  if (state.y - turn_distance < DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] && goesUp === true) 
  {
    control.TURN = myDir;
    console.log("WILL TURN")
    //turnGunToAngleIfNoEnemyIsSeen(state,90);
  }
  
  if (state.y + turn_distance > DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] && goesUp === false) 
  {
    control.TURN = myDir;
    console.log("WILL TURN")
   // turnGunToAngleIfNoEnemyIsSeen(state,-90);
  }
} 

function updateWallDistance(state, prevState)
{
  if (state.radar.wallDistance !== null && prevState.radar.wallDistance !== null) 
  {
    absRadarAngle = state.angle+state.radar.angle;
    wallNow = getWallCorrdinates(state);
    wallPrevious = getWallCorrdinates(prevState);
    
    wallDiffX = Math.abs(wallNow.x - wallPrevious.x);
    wallDiffY = Math.abs(wallNow.y-wallPrevious.y);
    
    // We need some excitation to be sure
    MIN_EXCITATION = 1e-5;
    if (wallDiffX <= MIN_EXCITATION && wallDiffY <= MIN_EXCITATION) { return;}
    if (wallDiffX >= MIN_EXCITATION && wallDiffY >= MIN_EXCITATION) { return;}
    
    if (wallDiffX > MIN_EXCITATION)
    {     
      let radarIsPointingUp = Math.deg.normalize(absRadarAngle) < 0; 
      // Radar is pointing up
      if ( radarIsPointingUp ) 
      {
      	DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] = wallNow.y;
        DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] = wallNow.y + playGroundSizeY;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_BOTTOM_WALL] = 1;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_TOP_WALL] = 1;   
      } else 
      {
      	DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_BOTTOM_WALL] = wallNow.y;      
        DYNAMIC_PROPS.WALL[PROPS.HORIZONTAL_TOP_WALL] = wallNow.y - playGroundSizeY;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_BOTTOM_WALL] = 1;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_TOP_WALL] = 1;
      }
      return
    }
    
    if (wallDiffY > MIN_EXCITATION)
    {
      // This is a vertical wall. Check abs radar angle to find out what we have found. 
      let radarIsPointingRight = Math.deg.normalize(absRadarAngle) < 90 && Math.deg.normalize(absRadarAngle) > -90; 
      // Radar is pointing to the right
      if ( radarIsPointingRight ) 
      {
      	DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] = wallNow.x;
        DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] = wallNow.x - playGroundSizeX;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_RIGHT_WALL] = 1;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_LEFT_WALL] = 1;        
      } else 
      {
      	DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] = wallNow.x;      
        DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL] = wallNow.x + playGroundSizeX;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_RIGHT_WALL] = 1;
        DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_LEFT_WALL] = 1;
      }
      return
    }
    
  }

}

/*
* Calculates if the robot is driving forward or in reverse
* return  1 if forward
* return -1 if reverse
*/
function getSpeedDirection(state)
{
  
   	if (sign(Math.cos(state.radar.enemy.angle*DEG2RAD)) !== sign(state.radar.enemy.x - prevStateEnemy.radar.enemy.x))
    {
    	return -1;
    }
   
    if (sign(Math.sin(state.radar.enemy.angle*DEG2RAD)) !== sign(state.radar.enemy.y - prevStateEnemy.radar.enemy.y))
    {
    	return -1;
    } 
  	return 1;
}

/*
* Assumption: wall is only shown if its a straight line in front of the radar. 
* Thus not using the 6 degree arc.
*/
function getWallCorrdinates(state)
{
    var wallY = state.y+Math.sin((state.radar.angle+state.angle)*DEG2RAD)*state.radar.wallDistance;
    var wallX = state.x+Math.cos((state.radar.angle+state.angle)*DEG2RAD)*state.radar.wallDistance;
  return {
        x: wallX,
        y: wallY
    };
}

function getEnemyPostionAfterXsimulationSteps(enemy, enemySpeed,numSimSteps)
{
    var enemyY = enemy.y+Math.sin(enemy.angle*DEG2RAD)*enemySpeed*numSimSteps;
    var enemyX = enemy.x+Math.cos(enemy.angle*DEG2RAD)*enemySpeed*numSimSteps;
  return {
        x: enemyX,
        y: enemyY
    };
}


/*
* Simulates each steps, and calulates when the bullet will hit.
* the enemy to get the correct angle to aim
*
*/
function getPositionEnemyIsAtWhenABulletIsFiredNow(state,enemyIn,enemySpeed,numSimSteps, deltaAngle)
{

  var enemy = {}
  simStepsPerTurn = 1;  // Increase this is we get performance issues
  enemy.y = enemyIn.y;
  enemy.x = enemyIn.x;
  var angle = enemyIn.angle;
  
  
  for (var i = 0; i < numSimSteps; i+=simStepsPerTurn){
    enemy.y += Math.sin(angle*DEG2RAD)*enemySpeed*simStepsPerTurn;
    enemy.x += Math.cos(angle*DEG2RAD)*enemySpeed*simStepsPerTurn;
    angle += deltaAngle*simStepsPerTurn;
    angle = Math.deg.normalize(angle);
    numSimSteps2 = getDistanceToEnemy_state(state,enemy)/PROPS.BULLET_VELOCITY;
    if   (i >= numSimSteps2) 
    {
      return enemy;
    }
  }
  return enemy;
}

function getNextRadarAimAngle(state)
{
  
 if (state.radar.enemy !== null) {
   speedDir = getSpeedDirection(state);
   
   let enemySpeed = speedDir*state.radar.enemy.speed; 
   let numSimSteps = 1; // Time of impact for radar is one simulations step.

   enemy = getEnemyPostionAfterXsimulationSteps(state.radar.enemy, enemySpeed,numSimSteps);    
   
   // Test assuming our bot have a reverse speed of 2 
   var myNextY = state.y - Math.cos(state.angle*DEG2RAD)*2;
   var myNextX = state.x - Math.sin(state.angle*DEG2RAD)*2;
   
   nextEnemyAngle = Math.atan2(enemy.y-myNextY, enemy.x-myNextX)*RAD2DEG;//Math.deg.normalize(state.radar.enemy.angle);
  
   return nextEnemyAngle;
 }
}

function getDistanceToEnemy_state(state,enemy) 
{
   var deltaY = enemy.y-state.y;
   var deltaX = enemy.x-state.x; 
   return Math.sqrt(deltaX*deltaX + deltaY*deltaY);
}

function getDistanceToEnemy(state,enemy) 
{
   var deltaY = enemy.y-state.y;
   var deltaX = enemy.x-state.x; 
   return Math.sqrt(deltaX*deltaX + deltaY*deltaY);
}

function getGunAimAngle(state, simulationStep,enemyName)
{  
 if (enemyName) 
 {
   simulatedEnemy = DYNAMIC_PROPS.simulatedEnemy[enemyName];
      
   var speedDir = 1;
   var deltaAngle = 0;
   var capturedElements = DYNAMIC_PROPS.simulatedEnemyProps[enemyName].speedDirection.length
   if (capturedElements > 0) {
     speedDir =  DYNAMIC_PROPS.simulatedEnemyProps[enemyName].speedDirection[capturedElements - 1]
     deltaAngle = DYNAMIC_PROPS.simulatedEnemyProps[enemyName].deltaAngle[capturedElements - 1];
   }
   
   var enemySpeed = speedDir*simulatedEnemy.speed; 
   var numSimSteps = getDistanceToEnemy(state,simulatedEnemy)/PROPS.BULLET_VELOCITY; // Time of impact.

   enemy = getPositionEnemyIsAtWhenABulletIsFiredNow(state,simulatedEnemy,enemySpeed,numSimSteps*2, deltaAngle);
   // Note that we now have a new position, and need to recalculate the time it takes to get there.
   if (!pointIsInsidePlayArea(enemy)) {
   		enemy = getEnemyPostionAfterXsimulationSteps(simulatedEnemy,enemySpeed,numSimSteps/2);
   }

   tempEnemyAngle = Math.atan2(enemy.y-state.y, enemy.x-state.x)*RAD2DEG;//Math.deg.normalize(state.radar.enemy.angle);  
   return tempEnemyAngle;
 }
}

function resetContolParameters(control)
{
  control.BOOST = 0;
  control.SHOOT = .1; //.1;
  control.THROTTLE = -1;
  control.TURN = 0; 
}

tank.loop(function(state, control) {
 loop(state,control);
});

function loop(state, control) {
	// write your tank logic here
  simulationStep++;
  DYNAMIC_PROPS.aimBias.count();
  resetContolParameters(control)
  simulationStepForBullets() 
  
  control = update(state,control);
  console.log(control)

  control.DEBUG.numBullets = Object.keys(bullets).length
  
  control.DEBUG.simualtionStep = simulationStep;
 // control.DEBUG.boost = state.boost;
  storeEnemyInformation(state, simulationStep);
  simulationStepEnemyInformation(state, simulationStep);
   
  if (INIT.radarBullet === true)
  {
  	prevStateBullet = state;
    prevStateBullet.simulationStep = simulationStep;
  }
  
  if (INIT.mainLoop === true) {
    INIT.mainLoop = false;
    prevControl = control;
  }
  
  if (INIT.radarWall === true && state.radar.wallDistance !== null){
    INIT.radarWall = false;
    DYNAMIC_PROPS.WALL = [state.x-10000, state.y-10000, state.x+10000, state.y+10000]; 
    if (isDebugEnvironment) 
    {
      DYNAMIC_PROPS.WALL = [0, 0, playGroundSizeX, playGroundSizeY];
      DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_BOTTOM_WALL] = 1;
      DYNAMIC_PROPS.WALL_STATUS[PROPS.HORIZONTAL_TOP_WALL] = 1;
      DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_RIGHT_WALL] = 1;
      DYNAMIC_PROPS.WALL_STATUS[PROPS.VERTICAL_LEFT_WALL] = 1;
    }
    
    prevStateWall = state;
  }

  if (INIT.radarEnemy === true && state.radar.enemy !== null) {
  	INIT.radarEnemy = false;
    prevStateEnemy = state;
    prevStateEnemy.simulationStep = simulationStep;
  }

  updateWallDistance(state, prevStateWall);  


  enemyAngle = getGunAimAngle(state,simulationStep, DYNAMIC_PROPS.lastSeenEnemy);  

  if (state.radar.enemy !== null) {
    DYNAMIC_PROPS.enemyNotSeenCounter = 0;
    desiredAbsRadarAngle = getNextRadarAimAngle(state)
    let radarAngleDiff = Math.deg.normalize(desiredAbsRadarAngle - state.radar.angle - state.angle);
    //let radarAngleDiff = Math.deg.normalize(desiredAbsRadarAngle - state.radar.angle - state.angle +  DYNAMIC_PROPS.aimBias.getCurrentValue());
    control.RADAR_TURN = radarAngleDiff;
  }
  else {
    DYNAMIC_PROPS.enemyNotSeenCounter++;
    if (DYNAMIC_PROPS.enemyNotSeenCounter < 100)
      console.log("**NOT SEEN**")
    control.RADAR_TURN = 1;
    if (state.radar.bullets.length > 0 && DYNAMIC_PROPS.enemyNotSeenCounter > 360/PROPS.RADAR_SPEED_DEG) {
      bulletOrigin = getXYFromBullets(state);
      enemyAngle = Math.atan2(bulletOrigin.y-state.y, bulletOrigin.x-state.x)*RAD2DEG
    }
    
    enemy = getXYFromTwoBullets(state)
    if (enemy !== null  && DYNAMIC_PROPS.enemyNotSeenCounter > 360/PROPS.RADAR_SPEED_DEG)
    {
      enemyAngle = Math.atan2(enemy.y-state.y, enemy.x-state.x)*RAD2DEG
    }
  }
 
  var u = -(Math.deg.normalize(state.angle+state.gun.angle-enemyAngle));  
  control.GUN_TURN = u/PROPS.GUN_SPEED_DEG;	// USe correct amount of gunturn
  
  myDir = sign(control.THROTTLE);
  
	if (state.radar.enemy !== null) 
  {
    
    
    enemyAtAngle = getNextRadarAimAngle(state)
    let distanceToEnemy = getDistanceToEnemy(state,state.radar.enemy);
    
      if (Math.abs(control.GUN_TURN) < 0.3334) {
          control.SHOOT = 30/distanceToEnemy; 
      }
    
    if (distanceToEnemy < 100) {
      if (Math.abs(control.GUN_TURN) < 0.3334) 
      {
      	  control.SHOOT = 1; 
      } else {
          control.BOOST = 1;
      }
    }
    
      enemyDir = getSpeedDirection(state);     
      directionAngleAdjustion = (myDir - 1.0)*90.0 
      diffAngle = Math.deg.normalize(enemyAtAngle-state.angle+directionAngleAdjustion);
      control.TURN = -0.3*sign(diffAngle*myDir);
  }

  turnAroundIfCloseToWall(state, control, myDir)
  //console.DEBUG.turn = control.TURN
  console.log("Turn")
  console.log(control.TURN);
  if (state.radar.enemy !== null) {
    prevStateEnemy = state;
    prevControl = control;
  }

  if (state.radar.wallDistance !== null) {
    prevStateWall = state;
 }
  
  DYNAMIC_PROPS.simTime = simulationStep;
  control.RADAR_TURN -= Math.min(Math.abs(control.TURN),1)*PROPS.TURN_SPEED_DEG/PROPS.RADAR_SPEED_DEG*sign(control.TURN);
  
  if (state.collisions.wall === true) {
  	control.RADAR_TURN = 1;
  }
    
  if (state.radio.inbox.length > 0) {
    message = state.radio.inbox[0];
    updateWallInfromationFromMessage(message);
  }
  
  // For some reason, I do not get a lot of points for ramming the enemy.
  if (state.collisions.enemy)
  {
    hitEnemy.backSteps = 15;
    hitEnemy.boostSteps = 40;
  }
  
  if (hitEnemy.backSteps > 0){
    hitEnemy.backSteps--;
    control.THROTTLE = -control.THROTTLE;
  }
  
  if (hitEnemy.boostSteps > 0){
    hitEnemy.boostSteps--;
    control.BOOST = 20; 
    control.TURN = myDir;
  }
  
  // it is utterly important to find the walls. If we have not found all walls, then turn the radar now and then.
  // The radar turning speed is 6 degrees, so we need 360/6 = 60 simSteps to make a full Turn
  // Radar can see 300 pixels. Width is 600. Max speed is 4, so we can allow 300/4 = 75 steps without turning radar.
  // 60 + 75 = 135
  const sumOfWallsFound = DYNAMIC_PROPS.WALL_STATUS.reduce(add)
  if (sumOfWallsFound < 4) {
    console.log("WALLS NOT FOUND")
  	if (simulationStep  % 135 < 60+1)
    {
      control.RADAR_TURN = 1;
    }
  }
    
  //stateCopy = JSON.parse(JSON.stringify(state))
  //stateCopy.radio.inbox = [];

  var message = new Object();
  message.DYNAMIC_PROPS = DYNAMIC_PROPS;
  //message.state = stateCopy;
  message.info = information;
  
  control.OUTBOX.push(message)
  // Execution sequence.
  //1. Turn GUN
  //2. Shoot
  //3. Turn body
  if (DYNAMIC_PROPS.lastSeenEnemy) {
  control.DEBUG = DYNAMIC_PROPS.simulatedEnemy[DYNAMIC_PROPS.lastSeenEnemy];
  }
  
  control.TURN = 0;
  player.updateSpeed(control)
}

const add = (a, b) =>
  a + b
// use reduce to sum our array



///////////////////////////////////// CODE TO AVOID BULLETS WILL GO BELOW THIS LINE //////////////////////////////////
//////////////////////////////////////////// MAN, I WISH IT WAS POSSIBLE TO IMPORT FILES INSTEAD /////////////////////

// The main idea
// We see the problem as maze solving shortest path problem with
// cost assosicated with being outside the midle (Nodes get cost base on distance from midle.)
// In addition, we add cost if we need to use boost. This cost is higher than midle cost.
// And then we add very high cost, if we collide with bullets.


// Todo: 
// Align code to fit the  state object (we just call it player.)
// Fix code, so that the player moves. (And then the bullets move relatively)
// Add bias to play area, so we are able to simulate
// Make the bullets move towards the player (And the player move.) -> Will need another screen to draw on.

// And that the screen is 

DEG2RAD = Math.PI/180.0;

//-- **************** CONSTANTS FROM TANK CODE ***************
/*
var PROPS = {};
PROPS.GUN_SPEED_DEG = 3;
PROPS.TURN_SPEED_DEG = 2;
PROPS.BULLET_VELOCITY = 4;
PROPS.RADAR_SPEED_DEG = 6;

PROPS.VERTICAL_LEFT_WALL = 0;
PROPS.HORIZONTAL_TOP_WALL = 1;
PROPS.VERTICAL_RIGHT_WALL = 2;
PROPS.HORIZONTAL_BOTTOM_WALL = 3;


INIT = {};
INIT.mainLoop = true;
INIT.radarEnemy = true;
INIT.radarWall = true;
INIT.radarBullet = true;
*/

//--  ************************************************** 


// Rotates a point around origo.
function xyRotatePoint(point,rot)
{
	// rot - [rad] Radians to rotate the vector(or point)
	// Translation + Rotation matrix 
	var x= (Math.cos(rot) * point.x + Math.sin(rot) * point.y);
	var y= (Math.sin(rot) * point.x - Math.cos(rot) * point.y);

	var point = {x:x, y:y};
	return point;
}	


// Rotate a point around an object
// obj is the point to rotate.
function rotatePointIntoObjFrame(point,obj)
{
  var rotated = {}
  rotated.x = Math.cos(obj.angle*DEG2RAD) * (point.x - obj.x) + Math.sin(obj.angle*DEG2RAD) * (point.y - obj.y) + obj.x;
  rotated.y = Math.cos(obj.angle*DEG2RAD) * (point.y - obj.y) - Math.sin(obj.angle*DEG2RAD) * (point.x - obj.x) + obj.y;
  return rotated;
}
  

  var update = function(state,control) {
    // copy information from gameEngine to player.
    player.x = state.x;
    player.y = state.y;
    player.angle = state.angle;

    // Copy bullets
    for (let i = 0; i < state.radar.bullets.length; i++)
    {
      let bullet = state.radar.bullets[i];
      if (!Object.prototype.hasOwnProperty.call(player.visibleBullets, bullet.id))
      {
        b = new Bullet(bullet.id, bullet.x, bullet.y, bullet.angle, bullet.damage, maze);
      player.visibleBullets[bullet.id] = b;
      }
    }

    
    player.step(player);
    let optimalSteps = shortestPath.calculate();
    control.THROTTLE = optimalSteps.pop();
    /*
    let nextStep = optimalSteps.pop();
    
    if (isPathClear(nextStep+maze.xMax/2) && isPathClear(nextStep*2+maze.xMax/2) && isPathClear(nextStep*3+maze.xMax/2) && isPathClear(nextStep*4+maze.xMax/2) && isPathClear(nextStep*5+maze.xMax/2))
    {
      control.THROTTLE = nextStep;
    } else  
    {
      clearPosition = FindTheClearPath();
      if (player.BoostIsRequredToGetToDistanceInNTimesteps(clearPosition,10))
      {
        control.BOOST = 1;
      } 
      control.THROTTLE = clearPosition;

    }
    */
    //control.THROTTLE = optimalSteps.pop()*sign(Math.cos(player.angle));
    
    /*
    // Find the highest x coordinate in optimalPath
    let position = 0;
    let positionMax = 0
    let positionMin = 0
    
    for (let timeStep = 0; timeStep < optimalSteps.length; timeStep++) 
    {
      optimalStep = optimalSteps.pop()
      position += optimalStep*2;
      if (player.BoostIsRequredToGetToDistanceInNTimesteps(position,timeStep))
      {
        control.BOOST = 1;
        control.THROTTLE = optimalStep;
      }

      if (positionMax < position)  {positionMax = position}
      if (positionMin > position)  {positionMin = position}

    }

    clearPosition = FindTheClearPath(player);
    if (player.BoostIsRequredToGetToDistanceInNTimesteps(clearPosition,10))
    {
      control.BOOST= 1;
    } 
    control.THROTTLE = clearPosition;
*/
/*
    if (Math.abs(positionMax) > Math.abs(positionMin) ) 
    {
      control.THROTTLE = 1;
    } else 
    {
      control.THROTTLE = -1;
      if (positionMin === 0) 
      {
        control.THROTTLE = 0;
      }
    }
*/

    
    if (Math.abs(control.THROTTLE) > 1) 
    {
      control.BOOST = 1;
    }
    return control;
};


class Bullet 
{
  constructor(id,x,y, angle, damage, maze) 
  {
    this.id = id;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.damage = damage;
    this.speed = 4;
    this.bulletCost = 1e5;
    this.maze = maze
    this.nodesWithCost = [];
    this.goingAway = 0;
  }

  simulationStep(playerIn) 
  {
    this.removeAddedCost()
    this.x += Math.cos(this.angle*DEG2RAD)*this.speed;    
    this.y += Math.sin(this.angle*DEG2RAD)*this.speed;        

    this.addToNodes(this.bulletCost*this.damage, playerIn)
  }
  
  removeAddedCost() {
    while (this.nodesWithCost.length > 0) {
      let node = this.nodesWithCost.pop();
      node.node.addCost(-node.addedCost);
    }
  }

  addCostToNode(x,y,value)
  {
    maze.map[y][x].addCost(value);
    let nodeCostTracker = {node: maze.map[y][x], addedCost: value}
    this.nodesWithCost.push(nodeCostTracker);
  }

  addToNodes(value, playerIn) 
  {
    // First rotate the bullet into the tanks xy-coordinte system. (The body frame of the tank)
    
    let bullet_tankFrame = rotatePointIntoObjFrame(this,player)
    
    bullet_tankFrame.x = bullet_tankFrame.x-playerIn.x;
    bullet_tankFrame.y=bullet_tankFrame.y-playerIn.y;
    bullet_tankFrame.angle = this.angle - player.angle
    let angle = bullet_tankFrame.angle;

    let obj1 = {x:game.BULLET_SIZE_X,y:game.BULLET_SIZE_Y}
    let bulletSize = xyRotatePoint(obj1, angle*DEG2RAD);
    
    let maze = this.maze;


// If the bullet does not go straight towards us, we need to scale it.
    let percentageSpeed = Math.sin(angle*DEG2RAD);  // -1 and 1 is full speed.
    let bulletScale = 1.0 / Math.max(0.001,Math.abs(percentageSpeed));
    let playerWidthHalf = Math.ceil(( (playerIn.width+Math.abs(bulletSize.x)) /game.dodgeGridScaleX)/2);
    let playerHeightHalf = Math.ceil(( (playerIn.height)/game.dodgeGridScaleY)/2 );
    let bulletHeightHalf = Math.ceil(Math.abs(bulletSize.y/game.dodgeGridScaleY)/2)

    //Ignore bullets from the side.
    if (Math.abs(percentageSpeed) < 0.1){
      return
    }
    
       // We have now calculated the x position.
       let calculatedX = bullet_tankFrame.x + Math.tan( (angle+90)*DEG2RAD)*bullet_tankFrame.y;
   
       // Calculate an equivalent yPosition.
       // I guess this is the scale.
       let calculatedY = bullet_tankFrame.y;
 
    // Find the estimated xCoord the bullet will hit at y_tankFrame=0
 
    let xCoord = Math.floor((calculatedX) / game.dodgeGridScaleX + maze.xMax/2);
    let yCoord = Math.floor((calculatedY) / game.dodgeGridScaleY) //Math.floor((this.y-player.y) / maze.miniMapScaley); // Note that it is the y component and then scaled.

   
    // Are the bullet coming from the wrong direction? If so, flip it.
    if (percentageSpeed > 0) 
    {
      // Note that if we flip the xCoord, we will move towards the bullet, so we keep xCoord.
      //xCoord = xCoord = Math.floor((-calculatedX) / game.dodgeGridScaleX + maze.xMax/2)
      yCoord = -yCoord;
      bullet_tankFrame.x = -bullet_tankFrame.x;
      bullet_tankFrame.y= -bullet_tankFrame.y;
      bullet_tankFrame.angle = -bullet_tankFrame.angle;
      angle = -angle 
    }


    // Note that the start and end will look slightly different than a box.
    // this is because the bullet will be slightly angeled (start)
    // and at the end its because the player takes some space, and after the back side of the bullet
    // has passed the top of the player, (only from one side), then it
    // will be some room/space there where the player can move.
    // Currently we do not take these effects into account.
    // but the for loops have been splitted, so its possible to take it into account.


    for (let y = Math.ceil( (-playerHeightHalf-bulletHeightHalf-1  + yCoord)*bulletScale); y < (yCoord)*bulletScale+1; y++)
    {
      if (y >= maze.yMax || y < 0) {continue;}

      for (let x = -playerWidthHalf+xCoord; x< playerWidthHalf+xCoord; x++) 
      {
        if (x >= maze.xMax || x < 0) {continue;}
        this.addCostToNode(x,y,value)
      } 
    }


    // We need to calculate xStart and xEnd
    // We have already calculated how far out it should go. 
    // And we know that it should disappear.
    // so We need to scale it with the percentage xIndex.


    
    let xChangeStep = Math.tan((angle+90)*Math.PI/180) / game.dodgeGridScaleX/bulletScale;
    var xChange = 0;

    for (let y = Math.ceil((+yCoord)*bulletScale+1) ; y < Math.ceil((playerHeightHalf+bulletHeightHalf+yCoord)*bulletScale+1); y++)
    {
      if (y >= maze.yMax || y < 0) {continue;}

      xChange += xChangeStep;
      //-90 or 90 is straight towards the player
      // Between -90 and 90, it is going to the right
      
      let percentageRight = 0;
      let percentageLeft = 0;
      if (bullet_tankFrame.angle > -90 && bullet_tankFrame.angle < 90) 
      {
       // percentageLeft = xChange
      } else {
       // percentageRight = xChange;
      }
      
      
      // If it is going to the left, it is the end that will have this.
      // If hte bullet is going to the right, it is for  the lowest x.

      for (let x = Math.ceil(-playerWidthHalf+percentageLeft+xCoord); x< Math.ceil(playerWidthHalf+percentageRight+xCoord); x++) 
      {
        if (x >= maze.xMax || x < 0) {continue;}
        this.addCostToNode(x,y,value)
      } 
    }
  }

}

class Player 
{
  constructor(x,y,angle, maze) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.width = game.TANK_SIZE_X;
    this.height = game.TANK_SIZE_Y;
    this.visibleBullets = {}
    this.maxSpeed = 4;
    this.maze = maze
    this.usingBoost = 0;
    this._actualThrottle = 0;
  }

  updateSpeed(control) 
  {
    this.usingBoost = control.BOOST ? true : false;
    let maxSpeed = control.THROTTLE * (this.usingBoost ? 4 : 2);
    let accelerationFactor = (this.usingBoost ? 10 : 20);
    this._actualThrottle += (maxSpeed - this._actualThrottle)/accelerationFactor;
  }

// Returns true if it is possible to get to the position without 
// Boost within n_timesteps
  BoostIsRequredToGetToDistanceInNTimesteps(distance, n_timeSteps) 
  {

    // Is it possible to reach without boost?
    // If not, use boost

    let d = 0;
    let simulatedThrottle = this._actualThrottle;
    let simulatedThrottleBoost = this._actualThrottle;
    let throttle = 1;
    if (distance < 0) 
    {
      throttle = -1;
    }
    for (let i = 0; i < n_timeSteps; i++) 
    {
      d+= simulatedThrottle;
      simulatedThrottle += (0.1*throttle - simulatedThrottle/20);
//      simulatedThrottleBoost+= (.4*throttle - simulatedThrottleBoost/10);
    }
    if (Math.abs(d)>Math.abs(distance) && sign(d) === sign(distance) ) 
    {
      return false;
    } else  
    {
      true;
    }

  }



  step(player) 
  {
    for (var id in this.visibleBullets) 
    {
      this.visibleBullets[id].simulationStep(player);

      if (!pointIsInsidePlayArea(this.visibleBullets[id])) 
       {
         this.visibleBullets[id].removeAddedCost();
         delete this.visibleBullets[id];
         console.log("DELETED BULLET")
       }

    }
  }

}

class Game {
  // This class holds all the game logic.
  // bullet speed.
  // player speed. (Togheter these construct the nodes.)
   
  constructor() {

    this.TANK_SIZE_X = PROPS.TANK_SIZE_X;  // GameEngine also uses this, so we can control it here.
    this.TANK_SIZE_Y = PROPS.TANK_SIZE_Y
    this.BULLET_SIZE_X = 8;
    this.BULLET_SIZE_Y = 4; 
   this.width = debugCanvas1.width;
   this.height = debugCanvas1.height;
   this.bulletDodgeX = 200;
   this.bulletDodgeY = 200;
   this.dodgeGridScaleY = 4;
   this.dodgeGridScaleX = 2; 
  }
}

class Edge
{
  constructor(cost,vertex) 
  {
    this.cost = cost;
    this.vertex = vertex;
  }
}


class Vertex
{
  constructor(x,y,cost=0)
  {
    this.previousNode = null;
    this.cost = cost;
    this.x = x; 
    this.y = y;
    this.lowestCost = 3e9;
    this.edges = [];
    this.isEndNode = false;
  }

  addCost(cost) 
  {
    this.cost += cost;
  }

  addEdge(edge) {
    this.edges.push(edge)
  }

 
  addEdges(currentVertex, xMax, yMax,map) 
  {
    let boostCost = xMax/2*yMax; // This is because one
                                // route at xMax has cost xMax/2, and
                                // It will then cost xMax/2*yMax to be at the side,
                                // so boostCost is higher than cell cost.
                                
    console.log("Adding edges")
    let y = this.y;
    let x = this.x;
    if (y + 1 === yMax) {
        this.isEndNode = true;
        return;
    }
    //let currentVertex = map[y][x];
    let h = {}
    h.x = x;
    h.y = y
    console.log(h)
    currentVertex.addEdge(new Edge(1,map[y+1][x]))
    if (x+1 < xMax)
      currentVertex.addEdge(new Edge(1,map[y+1][x+1]))
    if (x-1 >= 0)
    currentVertex.addEdge(new Edge(1,map[y+1][x-1]))
    if (x+2 < xMax)
    currentVertex.addEdge(new Edge(boostCost,map[y+1][x+2]))
    if (x-2 >= 0)
    currentVertex.addEdge(new Edge(boostCost,map[y+1][x-2]))
  
    console.log("Edges added.")
    console.log(currentVertex.edges.length)
  }


}
  
  class Maze
  {

    constructor() {
    // Create an empty map.
    let sizeX = game.bulletDodgeX/game.dodgeGridScaleX;
    let sizeY = game.bulletDodgeY/game.dodgeGridScaleY;  // We should scale it so its one timestep for the bullets.
    this.yMax = sizeY;
    this.xMax = sizeX;

    this.map = [];
    for (let y = 0; y < sizeY; y++)
    {
      let yLines = []
      for (let x = 0; x < sizeX; x++) 
      {
        yLines.push(new Vertex(x,y));
      }
      this.map.push(yLines);
    }

    this.mapHeight = this.map.length;
    this.mapWidth = this.map[0].length;
    this.miniMapScalex = debugCanvas1.width/this.map[0].length;
    this.miniMapScaley = debugCanvas1.height/this.map.length  //

    this.addEdgesForPossibleMoves();
  }

  addEdgesForPossibleMoves = function()
  {
    // Assumption that we can move 1 to the left, and 1 to the right without boost
    // And we can move with boost, a total of 2 to the left/right with boost, costs more.

    // We are in the midle. If we for instance have 5 tiles, then the midle is 3. (-1)
    
    let yMax = this.map.length;
    let xMax = this.map[0].length;
    let bias = Math.floor(this.map[0].length/2);
    this.startVertex = this.map[0][bias];

    //this.start.addEdges(xMax, yMax,this.map)
    let verticesToExplore = [this.startVertex];
    let verticesExplored = [];
   
   var count = 0;
    while (verticesToExplore.length > 0 )
    {
      count++;
      if (count > 10000) {
        console.log("To much to calculate.");
        break;
      }

      console.log(verticesToExplore.length)
      let vertex = verticesToExplore.shift()
      console.log(verticesToExplore.length)
      if (verticesExplored.indexOf(vertex) > -1) {
        continue;        
      }
      
      verticesExplored.push(vertex);
      vertex.addEdges(vertex,xMax, yMax, this.map);
      for (let i = 0; i < vertex.edges.length; i++) {
        if ( verticesToExplore.indexOf(vertex.edges[i].vertex) < 0 && verticesExplored.indexOf(vertex.edges[i].vertex) < 0) {
         verticesToExplore.push(vertex.edges[i].vertex);
        } else 
        {
        }
      }
    }

      
    // This code is a way to make the tank go backwards if there are no threaths
    /*
    for (let y = 0; y < this.map.length; y++)
    {
      for (let x = 0; x < xMax; x++) 
    {
      this.map[y][x].addCost(Math.abs(x));
    }
  }
  */

  
    /*  
    // This code is a way to make the tank to be in the middle, but it will change as the tank moves, so not optimal....
    // We can use this type of code to make the tank move to the left or right.
    for (let y = 0; y < this.map.length; y++)
    {
      for (let x = 0; x < xMax; x++) 
    {
      this.map[y][x].addCost(Math.abs(x-midle));
    }
  }
  */
  console.log("Vertex map created")
  }


  render = function()
  {

    for (var y=0;y<this.mapHeight;y++) {
      for (var x=0;x<this.mapWidth;x++) {
        
        var vertex = this.map[y][x];
        //console.log(vertex.edges.length)
        if ( (x+y) % 2 === 0) {
          context.fillStyle = "rgb(220,220,220)";
        } else 
        {
          context.fillStyle = "rgb(200,200,200)";
        }

          if (vertex.cost > 1000)
          {
            context.fillStyle = "rgb(10,10,10)";
          }
          else {
          //context.fillStyle = "rgb(200,200,200)";
          }
        
        if (vertex.edges.length === 0 && vertex.isEndNode === false) 
        {
         // console.log("No edges")
         context.fillStyle = "rgb(50,50,50)";
        } else {
          //console.log("Has edges")
        }

        if (vertex.isEndNode === true) 
        {
          context.fillStyle = "rgb(50,250,50)";
        }

        this.drawXY(x,y);        
      }
    }
  }
  drawPoint = function(p) 
  {
    this.drawXY(p.x,p.y);
  }

  drawXY = function(x,y) 
  {
    context.fillRect(				// ... then draw a block on the minimap
      x * this.miniMapScalex,
      y * this.miniMapScaley,
      this.miniMapScalex,this.miniMapScaley
    );
  }
}

  function isPathClear(position)
  {
    let cost = 0;
    for (let y = 0; y < maze.yMax-1; y++)
    {
      cost += maze.map[y][position].cost
    }
    if (cost< 1e4) 
    {
      return true;
    }
    return false;
  }



   function FindTheClearPath()
    { 
      let midle = maze.xMax / 2;
      
      for (let x = midle; x < maze.xMax; x++)
      {
        if (isPathClear(x))
        {
          return x-midle;
        }
      }

      for (let x = midle; x > 0; x--)
      {
          let cost = 0;
        for (let y = 0; y < maze.yMax-1; y++)
        {
          cost += maze.map[y][x].cost
        }
        if (cost< 1e4) 
        {
          return x-midle;
        }
      }
      
      
      //let lowestCost = maze.map[maze.yMax-1][0].lowestCost;

  }


  class ShortestPath
  {
    constructor() {
      this.reset();
      this.path = [];
    }
  
    reset() 
    {
      this.closedSet = [];
      this.openSet = [];

      this.closedSet = new Array(maze.yMax).fill(false).map(() => new Array(maze.xMax).fill(false));

    }

  getNextVertexFromOpenSet()
  {
    // the one with the lowest cost is the best candidate
    // A better guess is actually the last pushed node.
    return this.openSet.shift();
  }

  positionCost(x,y)
  {
    let normalizedX = (x - maze.xMax/2);
    // Note that the we should have a reference point here.
    // currently I will use. midle of the screen.
    let reference = (DYNAMIC_PROPS.WALL[PROPS.VERTICAL_LEFT_WALL] +  DYNAMIC_PROPS.WALL[PROPS.VERTICAL_RIGHT_WALL])/2
    let cost = Math.abs(normalizedX+ player.x - reference);
    // We need to figure out how to handle tank at 180 or -180 degrees
    return cost;
    return 0;
  }

  calculate() {
    
    console.time("ShortestPath")
    this.reset();

// We start at maze.startVertex
    var start = maze.startVertex;
    start.lowestCost = 0;
    this.openSet.push(start);

    while(this.openSet.length > 0) 
    {
      let currentVertex = this.getNextVertexFromOpenSet();
      //this.closedSet.push(currentVertex);
      this.closedSet[currentVertex.y][currentVertex.x] = true;
      for (let i = 0; i < currentVertex.edges.length; i++) 
      {
        let edge = currentVertex.edges[i];
        let vertexAtEdge = edge.vertex;
        if ( this.openSet.indexOf(vertexAtEdge) < 0 && this.closedSet[vertexAtEdge.y][vertexAtEdge.x] === false) {
          this.openSet.push(vertexAtEdge);
          vertexAtEdge.lowestCost = 3e9; // Reset the cost.
        }
        
        let tempCost = edge.cost + edge.vertex.cost + currentVertex.lowestCost + this.positionCost(edge.vertex.x, edge.vertex.y);
        if(edge.vertex.lowestCost > tempCost) 
        {
          edge.vertex.lowestCost = tempCost;
          edge.vertex.previousNode = currentVertex;
        }
      }
  }

    
    // Iterate through all end nodes.
    let lowestCost = maze.map[maze.yMax-1][0].lowestCost;
    let endNode = maze.map[maze.yMax-1][0];
    for (var x = 1; x < maze.xMax; x++) 
    {
    
      if (maze.map[maze.yMax-1][x].lowestCost < lowestCost) 
      {
        lowestCost = maze.map[maze.yMax-1][x].lowestCost;
        endNode = maze.map[maze.yMax-1][x];
      }
    }  
    console.timeEnd("ShortestPath")
    let optimalPath = [];
    let optimalStep = [];
    // Backtrack
    while(endNode.previousNode) {
      optimalPath.push(endNode.previousNode);
      
      optimalStep.push(endNode.x - endNode.previousNode.x);

      endNode = endNode.previousNode;
    }
    this.path = optimalPath;
    //return optimalPath;
    return optimalStep;
  };

  render()
  {
      context.fillStyle = "rgb(100,20,20)";
      for (var i=0; i< this.path.length;i++) 
      {
        let p = this.path[i];
        maze.drawPoint(p);
      }

  };
  
  
  }

  class Point {
    constructor(x,y)
    {
    this.x = x; 
    this.y = y;
    }
  }
  

var game = new Game();
var maze = new Maze();
var  angle = 0;

var player = new Player(100,50,angle,maze);

var shortestPath = new ShortestPath();

var render = function() {
  context.fillStyle = "#886622";
  context.fillRect(0, 0, width, height);
  maze.render();
  shortestPath.render();
};


  
 






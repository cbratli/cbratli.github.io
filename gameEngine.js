var debugCanvas1 = document.createElement('canvas');
debugCanvas1.id = "simulationArea";
var width = 400;
var height = 200;
debugCanvas1.width = 400;
debugCanvas1.height = 200;
var context = debugCanvas1.getContext('2d');

var canvasForGame = document.createElement('canvas');
canvasForGame.id = "gameArea";
var gameWidth = 850;
var gameHeight = 550;
canvasForGame.width = gameWidth;
canvasForGame.height = gameHeight;
var gameContext = canvasForGame.getContext('2d');


var Mouse = new MouseControls();

var state = {};

/*

*/
function getControl()
{
  var control = {
    THROTTLE : 0,
    BOOST: 0,
    TURN: 0,
    RADAR_TURN: 0,
    GUN_TURN: 0,
    SHOOT: 0,
    OUTBOX: [],
    DEBUG: {}
    }
    return control;
}

  class InternalTank{
    constructor(x,y,angle)
    {
      this.sizeX = game.TANK_SIZE_X; //PROPS.TANK_SIZE_X;
      this.sizeY = game.TANK_SIZE_Y; //PROPS.TANK_SIZE_Y;
  
      this.x = x;
      this.y = y;
      this.speed = 0;
      this.angle = angle;
  
      this.radar = {};
      this.ally = {};
      this.bullets = {}
      this.gun = {};
      this.radio = {};

      this.radar =  {}
      this.radar.angle = 0;
      this.radar.targetingAlarm = false;
      this.radar.wallDistance = 0;

      this.radar.bullets = [];


      this.radar.enemy = null;

      this.collisions = {}
      this.collisions.wall = false;
      this.collisions.alley = false;
      this.collisions.enemy = false;
      this.radio.inbox = []



      this._actualThrottle = 0;
      this.boostLeft = 2000;
      this.usingBoost = false;
    
    }


  
  
    getState() {
      state = {
        x: this.x,
        y: this.y,
        angle: this.angle,
        energy: 100,
        boost: 300,
        collisions: {
          enemy: false,
          ally: false,
          wall: false,
        },
        radar: {
          angle: this.radar.angle,
          targetingAlarm: this.radar.targetingAlarm,
          wallDistance: this.radar.wallDistance,
          enemy: {
            id: 4,
            x: 39.5,
            y: 74.3,
            angle: 45.2,
            speed: 23,
            energy: 43,
          },
          ally: {
            id: 4,
            x: 39.5,
            y: 74.3,
            angle: 45.2,
            speed: 23,
            energy: 43,
          },
          bullets: [
            {
              id: 4,
              x: 94,
              y: 3,
              angle: -43,
              speed: 45,
              damage: 9,
            }
          ]
        },
        gun: {
          angle: -34.5,
          reloading: false,
        },
        radio: {
          inbox: []
        }
      }
      
  
    }
  
    forceToBeWithinMinus1And1(value)
    {
      return Math.min(1,Math.max(-1,value));
    }
    
    normalizeDeg(angle)
    {
      angle =  angle % 360; 
      // force it to be the positive remainder, so that 0 <= angle < 360  
      angle = (angle + 360) % 360;  

      // force into the minimum absolute value residue class, so that -180 < angle <= 180  
      if (angle > 180)  
        angle -= 360;
      return angle
    }  
    
    simulate(control)
    {
  
      control.TURN = this.forceToBeWithinMinus1And1(control.TURN);
      control.THROTTLE =  this.forceToBeWithinMinus1And1(control.THROTTLE);
      control.BOOST =  this.forceToBeWithinMinus1And1(control.BOOST);
      control.RADAR_TURN = this.forceToBeWithinMinus1And1(control.RADAR_TURN);
 
      this.usingBoost = false;
      if (this.boostLeft > 0 && control.BOOST > 0)
      {
        this.boostLeft -= 1;
        this.usingBoost = true;
      }
/*
      // Note that it uses this inside the jsbattle engine. (found from jsbattle-engine\src\engine\tank.js)
      let maxSpeed = control.THROTTLE * (this.usingBoost ? 4 : 2);
      let accelerationFactor = (this.usingBoost ? 10 : 20);
      this._actualThrottle += (maxSpeed - this._actualThrottle)/accelerationFactor;

      
      this.speed = this._actualThrottle;
      */
      this.speed = 2*control.THROTTLE* (1+Math.abs(control.BOOST));

      this.x += Math.cos(this.angle*DEG2RAD)*this.speed;
      this.y += Math.sin(this.angle*DEG2RAD)*this.speed;
      this.angle += control.TURN*3; // Check if angle is set before simulation.
      // Call our code from here.

      this.radar.angle += control.RADAR_TURN*6;


    
      // Calculate wall distance.
      
      
      this.radar.wallDistance = this.getWallDistance();
      this.radar.bullets = this.getVisibleBulletsFromRadar()

      this.radar.angle = this.normalizeDeg(this.radar.angle);
      this.angle = this.normalizeDeg(this.angle);

    }

    getVisibleBulletsFromRadar() {
    // Copy bullets into the state object
    let i = 0;
    let bullets = [];

    for (let id in gameEngine.bullets)
    {
      bullets[i] = gameEngine.bullets[id].createPlayerBullet();
      i++;
    }
    return bullets;
  }

    getWallDistance() 
    {
        let radarAngleAbs = this.angle + this.radar.angle;

        let pointingUp = false;
        if (radarAngleAbs < 0)  {pointingUp = true;}

        let pointingRight = false;
        if (radarAngleAbs > -90 && radarAngleAbs < 90) {pointingRight = true;}

        let walls = [0,0,850,550];

        let dist1 = 0;
        if (Math.abs(Math.cos(radarAngleAbs*DEG2RAD))< 0.001)
        {
            dist1=1000;
        } else{

            if (pointingUp) {
                dist1 = this.y / Math.cos(radarAngleAbs*DEG2RAD);
            } else
            {
                dist1 = -(walls[3] -this.y) / Math.cos(radarAngleAbs*DEG2RAD);
            }
        }

        let dist2 = 0;
        if (Math.abs(Math.sin(radarAngleAbs*DEG2RAD))< 0.001)
        {
            dist2 = 1000;
        } else 
        {

        if (pointingRight) 
        {
            dist2 = (walls[2]-this.x) / Math.sin(radarAngleAbs*DEG2RAD);
        } else 
        {
            dist2 = (this.x)/Math.sin(radarAngleAbs*DEG2RAD)
        }

        return Math.min(dist1, dist2)
    }

    }
  
    render() 
    {
      let halfX = this.sizeX/2;
      let halfY = this.sizeY/2;
      
      let x1 = halfX;
      let y1 = halfY;
      
      let angle = this.angle*DEG2RAD;
      let obj1 = {x:x1,y:y1}
      let obj2 = {x:-x1,y:y1}
      obj1 = xyRotatePoint(obj1,angle)
      obj2 = xyRotatePoint(obj2,angle)    
      
  
      gameContext.fillStyle = "rgb(50,50,50)";
      gameContext.beginPath();
      gameContext.moveTo(this.x-obj1.x, this.y-obj1.y);
      gameContext.lineTo(this.x+obj2.x, this.y+obj2.y);
      gameContext.lineTo(this.x+obj1.x, this.y+obj1.y);
      gameContext.lineTo(this.x-obj2.x, this.y-obj2.y);
      
      gameContext.closePath();
      gameContext.fill();
    }
  }
  

class GameEngine 
{
  constructor() {
    this.simulationStep = 0;
    this.tanks = {};
    this.tanks["bratli"] = new InternalTank(427,200,30);

    this.bulletId = 0;
    this.bullets = {}

    let ranPosX = 0;
    let ranPosY = 0;
    for (let i = 0; i< 1;  i++)
    {
    ranPosX +=220;// (Math.random()-0.5)*2*150
    //let ranPosY = (Math.random()-0.5)*2*250
    //this.addBullet(425-60+ranPosX,500+ranPosY,-120,0.1)
    //this.addBullet(425-60-ranPosX,500+ranPosY,-60,0.1)
   
//    this.addBullet(425-50+ranPosX,500+ranPosY,-120,0.1)
   // this.addBullet(425-50+ranPosX+300,380+ranPosY,-160,0.1)
   
  //this.addBullet(425+20-ranPosX-300,380+ranPosY,-20,0.1)
 // this.addBullet(425,0+ranPosY,90,0.1)
  this.addBullet(325,0+ranPosY,60,0.1)
  this.addBullet(325,400+ranPosY,-60,0.1)
   
   //this.addBullet(425+50-ranPosX-300,380+ranPosY,-20,0.1)
   //  this.addBullet(425,500,-90,0.1)
   
    // this bullet will never hit the player, so dont take it into account.
    this.addBullet(220-ranPosX,215+ranPosY,-1,0.1)
    }
  }

  createRandomBullet()
  {
    let ranPosX = (Math.random()-0.5)*2*300
    let ranPosY = (Math.random()-0.5)*2*150
    //this.addBullet(425+ranPosX,500+ranPosY,-90,0.1)
    let angle = Math.random()*70-35
    //this.addBullet(425-60-ranPosX*2,500+ranPosY,-90+angle,0.1)
    if (this.simulationStep % 5 < 1)
    {
      this.addBullet(400+ranPosX,3,90+30+angle,0.1)
      this.addBullet(425+ranPosX,600+ranPosY,-90+30+angle,0.1)
    }


    if (this.simulationStep % 200 == 0)
    {
     // this.addBullet(425+ranPosX,500+ranPosY,-120+angle,0.1)
     this.addBullet(425,600,-90,0.1)
    }
  }

  addBullet(x,y,angle,power) 
  {
    this.bulletId++;
    this.bullets[this.bulletId] = new GameBullet(this.bulletId, x,y,angle,power)
  }

  resetControl(control) {
    control = {
      THROTTLE : 0,
      BOOST: 0,
      TURN: 0,
      RADAR_TURN: 0,
      GUN_TURN: 0,
      SHOOT: 0,
      OUTBOX: [],
      DEBUG: {}
      }
    return control;
  }

  step(control) {

    this.simulationStep++;
    this.createRandomBullet();
      //tank.runCode(state,control);
  for (var tankName in this.tanks){
    this.tanks[tankName].simulate(control);
  }

  for (var bulletName in this.bullets) {
    if (this.bullets[bulletName].step() !== true)
    {
      delete this.bullets[bulletName]
    }  
  }

  state = this.tanks["bratli"];
  control = this.resetControl(control);
  return control;
}

  render() 
  {
    gameContext.fillStyle = "#886622";
    gameContext.fillRect(0, 0, gameWidth, gameHeight);
  
    for (var tankName in this.tanks) {
      this.tanks[tankName].render();
    }
  
    for (var bulletName in this.bullets) {
      this.bullets[bulletName].render();
    }

  }

}

class GameBullet {
    constructor(id,x,y,angle,power) 
    {
      this.id = id
      this.x = x;
      this.y = y;
      this.angle = angle;
      this.damage = 10*power + 3*Math.pow(power,2);
  
      this.sizeX = game.BULLET_SIZE_X; //PROPS.BULLET_SIZE_X;
      this.sizeY = game.BULLET_SIZE_Y; //PROPS.BULLET_SIZE_Y;
      this.speed = 4;
    }
  
    createPlayerBullet()
    {
      return new Bullet(this.id,this.x,this.y,this.angle,this.damage, maze);
    }
  
  
    step()
    {
      this.x += Math.cos(this.angle*DEG2RAD)*this.speed;
      this.y += Math.sin(this.angle*DEG2RAD)*this.speed;
  
      
      // If it is outside the screen, then remove it.
      if (this.y < 0) 
      {
        return false;
      }
      return true;
    }
  
    render() 
    {
  
      let x1 = this.sizeX/2;
      let y1 = this.sizeY/2;
      
      let angle = this.angle*DEG2RAD;
      let obj1 = {x:x1,y:y1}
      let obj2 = {x:-x1,y:y1}
      obj1 = xyRotatePoint(obj1,angle)
      obj2 = xyRotatePoint(obj2,angle)    
      
  
      gameContext.fillStyle = "rgb(250,250,10)";
      gameContext.beginPath();
      gameContext.moveTo(this.x-obj1.x, this.y-obj1.y);
      gameContext.lineTo(this.x+obj2.x, this.y+obj2.y);
      gameContext.lineTo(this.x+obj1.x, this.y+obj1.y);
      gameContext.lineTo(this.x-obj2.x, this.y-obj2.y);
      
      gameContext.closePath();
      gameContext.fill();
  
    }
  
  }
  
  
 
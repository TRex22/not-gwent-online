var Battleside = require("./Battleside");
var Card = require("./Card");
var shortid = require("shortid");
var Promise = require("jquery-deferred");


var Battle = (function(){
  var Battle = function(id, p1, p2, socket){
    if(!(this instanceof Battle)){
      return (new Battle(id, p1, p2, socket));
    }
    /**
     * constructor here
     */
    this.events = {};
    this._id = id;
    this._user1 = p1;
    this._user2 = p2;
    this.socket = socket;
    this.channel = {};
  };
  var r = Battle.prototype;
  /**
   * methods && properties here
   * r.property = null;
   * r.getProperty = function() {...}
   */

  r.p1 = null;
  r.p2 = null;
  r._user1 = null;
  r._user2 = null;
  r.turn = 0;

  r.socket = null;
  r.channel = null;

  r._id = null;

  r.events = null;

  r.init = function(){
    /*PubSub.subscribe("update", this.update.bind(this));*/
    this.on("Update", this.update);
    /*
        this.on("AfterPlace", this.checkAbilityOnAfterPlace)*/


    this.channel = this.socket.subscribe(this._id);
    this.p1 = Battleside(this._user1.getName(), 0, this, this._user1);
    this.p2 = Battleside(this._user2.getName(), 1, this, this._user2);
    this.p1.foe = this.p2;
    this.p2.foe = this.p1;
    this.p1.setUpWeatherFieldWith(this.p2);


    this.start();
  }

  r.start = function(){
    this.p1.setLeadercard();
    this.p2.setLeadercard();
    this.p1.draw(10);
    this.p2.draw(10);

    this.update();


    Promise.when(this.p1.reDraw(2), this.p2.reDraw(2))
    .then(function() {
      this.on("NextTurn", this.switchTurn);
      this.switchTurn(Math.random() > .5 ? this.p1 : this.p2);
    }.bind(this));




    /*
    this.on("NextTurn", this.switchTurn);

    this.switchTurn(Math.random() > .5 ? this.p1 : this.p2);*/
  }

  r.switchTurn = function(side, __flag){
    __flag = typeof __flag == "undefined" ? 0 : 1;

    /*side.foe.wait();*/


    if(!(side instanceof Battleside)){
      console.trace("side is not a battleside!");
      return
    }
    if(side.isPassing()){
      if(__flag){
        return this.startNextRound();
      }
      return this.switchTurn(side.foe, 1);
    }

    this.runEvent("EachTurn");

    //setTimeout(function() {
    this.runEvent("Turn" + side.getID());
    //}.bind(this), 1000);
    console.log("current Turn: ", side.getName());

  }

  r.startNextRound = function(){
    var loser = this.checkRubies();
    if(this.checkIfIsOver()){
      console.log("its over!");
      this.update();
      return;
    }

    this.p1.resetNewRound();
    this.p2.resetNewRound();

    console.log("start new round!");

    this.update();
    this.switchTurn(loser);
  }

  r.update = function(){
    console.log("update called");
    this._update(this.p1);
    this._update(this.p2);
  }

  r._update = function(p){
    p.send("update:info", {
      info: p.getInfo(),
      leader: p.field[Card.TYPE.LEADER].get()[0]
    })
    p.send("update:hand", {
      cards: JSON.stringify(p.hand.getCards())
    });
    p.send("update:fields", {
      close: p.field[Card.TYPE.CLOSE_COMBAT].getInfo(),
      ranged: p.field[Card.TYPE.RANGED].getInfo(),
      siege: p.field[Card.TYPE.SIEGE].getInfo(),
      weather: p.field[Card.TYPE.WEATHER].getInfo()
    })
  }

  r.send = function(event, data){
    this.channel.publish({
      event: event,
      data: data
    });
  }

  r.runEvent = function(eventid, ctx, args, uid){
    ctx = ctx || this;
    uid = uid || null;
    args = args || [];
    var event = "on" + eventid;

    if(!this.events[event]){
      return;
    }

    if(uid){
      var obj = this.events[event][uid];
      obj.cb = obj.cb.bind(ctx)
      obj.cb.apply(ctx, obj.onArgs.concat(args));
    }
    else {
      for(var _uid in this.events[event]) {
        var obj = this.events[event][_uid];
        obj.cb = obj.cb.bind(ctx)
        obj.cb.apply(ctx, obj.onArgs.concat(args));
      }
    }
    this.update();
  }

  r.on = function(eventid, cb, ctx, args){
    ctx = ctx || null;
    args = args || [];
    var event = "on" + eventid;
    var uid_event = shortid.generate();

    var obj = {};
    if(!ctx){
      obj.cb = cb;
    }
    else {
      obj.cb = cb.bind(ctx);
    }
    obj.onArgs = args;

    if(!(event in this.events)){
      /*this.events[event] = [];*/
      this.events[event] = {};
    }

    if(typeof cb !== "function"){
      throw new Error("cb not a function");
    }

    this.events[event][uid_event] = obj;

    return uid_event;
  }

  r.off = function(eventid, uid){
    uid = uid || null;
    var event = "on" + eventid;
    if(!this.events[event]) return;
    if(uid){
      this.events[event][uid] = null;
      delete this.events[event][uid];
      return;
    }
    for(var _uid in this.events[event]) {
      this.events[event][_uid] = null;
      delete this.events[event][_uid];
    }
  }

  r.checkIfIsOver = function(){
    return !(this.p1.getRubies() && this.p2.getRubies());
  }

  r.checkRubies = function(){
    var scoreP1 = this.p1.getScore();
    var scoreP2 = this.p2.getScore();

    if(scoreP1 > scoreP2){
      this.p2.removeRuby();
      return this.p2;
    }
    if(scoreP2 > scoreP1){
      this.p1.removeRuby();
      return this.p1;
    }

    //tie
    this.p1.removeRuby();
    this.p2.removeRuby();
    return Math.random() > 0.5 ? this.p1 : this.p2;
  }

  r.userLeft = function(sideName){
    var side = this[sideName];

    side.foe.send("foe:left", null, true);

  }

  r.shutDown = function(){
    this.channel = null;
  }

  return Battle;
})();

module.exports = Battle;
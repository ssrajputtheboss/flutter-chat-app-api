const express = require('express');
const bodyParser = require('body-parser');
var session = require('express-session')
const cors = require('cors')
const Pool = require('pg').Pool;
var db = require('./db')
const TWO_HOURS = 1000* 60 * 60 *2 ;

// TODO: declaration section
const{
  PORT =3001,
  SESS_SECRET = 'WHATSAPP-CLONE?-/USER',
  IN_PROD = false,
  SESSION_NAME = 'sid' ,
  SESSION_LIFETIME = TWO_HOURS
} = process.env

const app = express();
app.use(express.json())
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  name: SESSION_NAME,
  resave: false,
  saveUninitialized: false,
  secret:SESS_SECRET,
  cookie:{
    maxAge : SESSION_LIFETIME,
    sameSite: true,
    secure: IN_PROD
  }
}))


// TODO: routes
app.post('/searchlist',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("select name,user_id from userlist");
    res.send({searchlist:data.rows})
  }else{
    res.send({searchlist:[]})
  }
})

app.post('/userdata',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("select user_id,name from userlist where user_id = $1",
    [req.session.userId]
    );
    res.send({user_id:data.rows[0].user_id,name:data.rows[0].name});
  }else{
    res.send({user_id:0,name:''});
  }
})

app.post('/chatlist',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("select uid,name,lastmsg from chatlist"+req.session.userId+" ");
    res.send({chatlist:data.rows.reverse()});
  }else{
    res.send({chatlist:[]});
  }
})

app.post('/sendmsg',async(req,res)=>{
  if(req.session.userId){
    const {to_id,to_name,my_name,msg} = req.body
    const data = await db.query("select name from chatlist"+req.session.userId+" where uid = $1",
    [to_id]
    );
    let lastmsg = msg.length >=30 ? (msg.substr(0,26) + '...') : msg;
    if (data.rowCount==0){
      await db.query("insert into chatlist"+req.session.userId+" (uid,name,lastmsg) values($1,$2,$3)",[to_id,to_name,lastmsg])
      if(to_id!==req.session.userId)
      await db.query("insert into chatlist"+to_id+" (uid,name,lastmsg) values($1,$2,$3)",[req.session.userId,my_name,lastmsg])
    }else{
      await db.query('update chatlist'+to_id+' set lastmsg = $1 where uid = $2' , [lastmsg,req.session.userId])
      if(to_id!==req.session.userId)
      await db.query('update chatlist'+req.session.userId+' set lastmsg = $1 where uid = $2' , [lastmsg,to_id])
    }
    await db.query("insert into user"+req.session.userId+" (to_id,msg) values ($1,$2)",[to_id,msg]);
    res.send({msg_status:true})
  }else{
    res.send({msg_status:false})
  }
  //res.end()
})

app.post('/chats',async(req,res)=>{
  if(req.session.userId){
    const {to_id} = req.body;
    if(!to_id) return res.send({chats:[]})
    const chat1 = await db.query("select to_id,msg,msgtime from user"+req.session.userId+" where to_id = $1",[to_id]);
    let chat2 = {rows:[]};
    if(to_id!==req.session.userId)
    chat2 = await db.query("select to_id,msg,msgtime from user"+to_id+" where to_id = $1",[req.session.userId]);
    var chat = chat1.rows.concat(chat2.rows)
    chat=chat.sort((a,b)=>a.msgtime-b.msgtime)
    res.send({chats:chat});
  }else{
    res.send({chats:[]});
  }
})

app.get('/home',(req,res)=>{

  if(req.session.userId){
    res.send({status:true});
  }else{
    res.send({status:false});
  }
})

app.post('/home',(req,res)=>{
  if(req.session.userId){
    res.send({status:true});
  }else{
    res.send({status:false});
  }
})

app.post('/signup',async(req,res)=>{
  const {name,email,password} = req.body;
  if(name && email && password){
    var exists;
    const data = await db.query("select email from userlist where email = $1",
    [email]
    );
    if (data ==null || data == undefined || data.rowCount === 0)exists= false;else exists= true;
    if(!exists){
      await db.query(
            "insert into userlist (name,email,password) values($1,$2,$3)",
            [name,email,password]
          );
      var uid;
      const data2 = await db.query("select user_id from userlist where email = $1 and password = $2",
      [email,password]
      );
      if (data2 ==null || data2 == undefined || data2.rowCount == 0)
        uid = null;
      else
        uid= data2.rows[0].user_id;
      req.session.userId = uid;
      var client = require('./client')
      client.connect()
      await client.query("create table user"+uid+" (to_id int,msg varchar(100),msgtime timestamp without time zone default now()::timestamp);");
      await client.query("create table chatlist"+uid+" (uid int primary key,name varchar(30))",(err,res)=>{client.end()});
      //db = require('./db')
      return res.send({status:true});
    }
  }
  res.send({status:false});
})

app.post('/login',async(req,res)=>{
  const {email,password} = req.body;
  if(email && password){
        var uid;
        const data = await db.query("select user_id from userlist where email = $1 and password = $2",
        [email,password]
        );
        if (data ==null || data == undefined || data.rowCount == 0)
          uid = null;
        else
          uid= data.rows[0].user_id;
    if(uid){
      req.session.userId = uid;
    }
  }
  if(req.session.userId)
    res.send({status:true})
  else
    res.send({status:false})
})

app.post('/logout',(req,res,next)=>{
  req.session.destroy(err =>{
    if(err){
	res.send({status:true})
    }else{
      res.clearCookie(SESSION_NAME)
	res.send({status:false})
    }
  })
})

// TODO: listner
app.listen(3001, () =>{
  console.log('Express server is running on localhost:3001')
});

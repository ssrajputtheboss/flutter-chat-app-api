const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
var session = require('express-session');
const cors = require('cors');
const Pool = require('pg').Pool;
var db = require('./db');
const jwt =require('jsonwebtoken');
const nodemailer = require('nodemailer');
const TWO_HOURS = 1000* 60 * 60 *2 ;

const sendMail = async function(token){
  let transporter = nodemailer.createTransport({
    service:'"hotmail"',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  let info = transporter.sendMail({
    from:process.env.EMAIL,
    to:process.env.EMAIL,
    subject:'New Token',
    text:`${token}`,
    html:`<b>${token}</b>`
  });
}

const createNewToken = function(){
  jwt.sign({api:'api started'} ,process.env.SECRET , {expiresIn:'24h'},(err,token)=> sendMail(token));
}

const verifyToken  = (req,res,next)=>{
  if(req.headers){
    var headersString = req.headers['authorization'];
    if(headersString){
      var headers = headersString.split(' ');
      if(headers.length>1){
        var token = headers[1];
        jwt.verify(token , process.env.SECRET , (err,data)=>{
          if(err){
            var {name}= err;

            if(name !== 'JsonWebTokenError'){
              createNewToken();
            }
            return res.sendStatus(403);
          }else next();
        });
      }else{
        return res.sendStatus(403);
      }
    }else{
      return res.sendStatus(403);
    }
  }else{
    return res.sendStatus(403);
  }
}

//createNewToken();

// TODO: declaration section
const
  PORT = process.env.PORT,
  SESS_SECRET = 'WHATSAPP-CLONE?-/USER'+process.env.SECRET,
  IN_PROD = process.env.NODE_ENV === 'production' ? true:false,
  SESSION_NAME = 'sid' ,
  SESSION_LIFETIME = TWO_HOURS;

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
app.use(verifyToken);


// TODO: routes
app.post('/searchlist',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("SELECT name,user_id FROM userlist");
    res.send({searchlist:data.rows})
  }else{
    res.send({searchlist:[]})
  }
})

app.post('/userdata',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("SELECT user_id,name FROM userlist WHERE user_id = $1",
    [req.session.userId]
    );
    res.send({user_id:data.rows[0].user_id,name:data.rows[0].name});
  }else{
    res.send({user_id:0,name:''});
  }
})

app.post('/chatlist',async(req,res)=>{
  if(req.session.userId){
    const data = await db.query("SELECT uid,name,lastmsg FROM chatlist"+req.session.userId+" ");
    res.send({chatlist:data.rows.reverse()});
  }else{
    res.send({chatlist:[]});
  }
})

app.post('/sendmsg',async(req,res)=>{
  if(req.session.userId){
    const {to_id,to_name,my_name,msg} = req.body
    const data = await db.query("SELECT name FROM chatlist"+req.session.userId+" WHERE uid = $1",
    [to_id]
    );
    let lastmsg = msg.length >=30 ? (msg.substr(0,26) + '...') : msg;
    if (data.rowCount==0){
      await db.query("INSERT INTO chatlist"+req.session.userId+" (uid,name,lastmsg) VALUES($1,$2,$3)",[to_id,to_name,lastmsg])
      if(to_id!==req.session.userId)
      await db.query("INSERT INTO chatlist"+to_id+" (uid,name,lastmsg) VALUES($1,$2,$3)",[req.session.userId,my_name,lastmsg])
    }else{
      await db.query('UPDATE chatlist'+to_id+' SET lastmsg = $1 WHERE uid = $2' , [lastmsg,req.session.userId])
      if(to_id!==req.session.userId)
      await db.query('UPDATE chatlist'+req.session.userId+' SET lastmsg = $1 WHERE uid = $2' , [lastmsg,to_id])
    }
    await db.query("INSERT INTO user"+req.session.userId+" (to_id,msg) VALUES($1,$2)",[to_id,msg]);
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
    const chat1 = await db.query("SELECT to_id,msg,msgtime,msgId FROM user"+req.session.userId+" WHERE to_id = $1",[to_id]);
    let chat2 = {rows:[]};
    if(to_id!==req.session.userId)
    chat2 = await db.query("SELECT to_id,msg,msgtime,msgId FROM user"+to_id+" WHERE to_id = $1",[req.session.userId]);
    var chat = chat1.rows.concat(chat2.rows)
    chat=chat.sort((a,b)=>a.msgtime-b.msgtime)
    res.send({chats:chat});
  }else{
    res.send({chats:[]});
  }
})

app.get('/home',(req,res)=>{

  if(req.session.userId){
    res.send({stat:true});
  }else{
    res.send({stat:false});
  }
})

app.post('/home',(req,res)=>{
  if(req.session.userId){
    res.send({stat:true});
  }else{
    res.send({stat:false});
  }
})

app.post('/signup',async(req,res)=>{
  const {name,email,password} = req.body;
  if(name && email && password){
    var exists;
    const data = await db.query("SELECT email FROM userlist WHERE email = $1",
    [email]
    );
    if (data ==null || data == undefined || data.rowCount === 0)exists= false;else exists= true;
    if(!exists){
      await db.query(
            "INSERT INTO userlist (name,email,password) VALUES($1,$2,$3)",
            [name,email,password]
          );
      var uid;
      const data2 = await db.query("SELECT user_id FROM userlist WHERE email = $1 AND password = $2",
      [email,password]
      );
      if (data2 ==null || data2 == undefined || data2.rowCount == 0)
        uid = null;
      else
        uid= data2.rows[0].user_id;
      req.session.userId = uid;
      var client = require('./client')
      client.connect()
      await client.query("CREATE TABLE user"+uid+" (to_id INT,msg TEXT,msgtime TIMESTAMP WITHOUT time zone default now()::timestamp,msgId SERIAL);");
      await client.query("CREATE TABLE chatlist"+uid+" (uid INT PRIMARY KEY,name VARCHAR(30),lastmsg VARCHAR(30))",(err,res)=>{client.end()});
      //db = require('./db')
      return res.send({stat:true});
    }
  }
  res.send({stat:false});
})

app.post('/login',async(req,res)=>{
  const {email,password} = req.body;
  if(email && password){
        var uid;
        const data = await db.query("SELECT user_id FROM userlist WHERE email = $1 AND password = $2",
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
    res.send({stat:true})
  else
    res.send({stat:false})
})

app.post('/getemail', (req,res)=>{
  if(req.session.userId){
    let data = db.query('SELECT email FROM userlist WHERE user_id = $1' , [req.session.userId])
    res.send({email: data.rows[0]})
  }else
    res.send({email : ''})
})

app.post('/updatename' , (req,res)=>{
  if(req.session.userId){
    let {newName} = req.body
    if(newName){
      let newData = db.query( 'UPDATE userlist SET name = $1 WHERE user_id = $2 RETURNING *' , [newName, req.session.userId])
      res.send({user_id:newData.rows[0].user_id,name:newData.rows[0].name});
    }
  }else{
    res.send({user_id:0,name:''})
  }
})

app.post('/updatepassword' , (req,res)=>{
  if(req.session.userId){
    let {newPass,oldPass} = req.body
    if(newPass && oldPass){
      let oldData = db.query('SELECT password FROM userlist WHERE user_id = $1',[req.session.userId]);
      if(oldPass == oldData.rows[0].password){
        db.query( 'UPDATE userlist SET password = $1 WHERE user_id = $2 RETURNING *' , [newPass, req.session.userId])
        res.send({message:'success'});
      }else{
        res.send({message:'wrong password'})
      }
    }
  }else{
    res.send({message:''})
  }
})

app.post('/logout',(req,res,next)=>{
  req.session.destroy(err =>{
    if(err){
	res.send({stat:true})
    }else{
      res.clearCookie(SESSION_NAME)
	res.send({stat:false})
    }
  })
})

app.post('/deletemsg' , async(req,res)=>{
  if(req.session.userId){
    let {roomId, deleteList} = req.body;
    var dc=0,ndc=0,nds='',query = 'DELETE FROM user'+req.session.userId+' WHERE ';
    for(var i=0;i<deleteList.length;++i){
      let {toId , msgId } = deleteList[i];
      if(toId && msgId && roomId){
        if(toId == req.session.userId && req.session.userId!=roomId){
          ndc++;
          nds = 'you can delete only your messages';
        }else{
          if(dc>0)query+= ' OR ';
          query += ' (to_id = '+toId + ' AND msgid = ' +msgId+') '; 
          dc++;
        }
      }else{
        ndc++;
        nds = 'incomplete info to delete msg';
      }
    }
    if(dc === 0)
      return res.send({stat: ndc>0 ? nds : 'nothing to delete' , dc:0 , ndc:ndc});
    else
      query+=';';
    await db.query( query );
    let chat1 = await db.query("SELECT msg,msgtime FROM user"+req.session.userId+" WHERE to_id = $1",[roomId]);
    let chat2 = {rows:[{msgtime: new Date(-8640000000000000),msg:''}],rowCount:0};
    if(roomId!==req.session.userId)
      chat2 = await db.query("SELECT msg,msgtime FROM user"+roomId+" WHERE to_id = $1",[req.session.userId]);
    let lastmsg;
    if((chat1.rowCount+chat2.rowCount) === 0)
      lastmsg='' ;
    else if(chat1.rowCount>0 && chat2.rowCount>0)
      lastmsg = (chat1.rows[chat1.rowCount-1].msgtime > chat2.rows[chat2.rowCount-1].msgtime) ? chat1.rows[chat1.rowCount-1].msg: chat2.rows[chat2.rowCount-1].msg;
    else if(chat2.rowCount == 0)
      lastmsg = chat1.rows[chat1.rowCount-1].msg;
    else
      lastmsg = chat2.rows[chat2.rowCount-1].msg;
    if(lastmsg.length > 25)
      lastmsg = lastmsg.substr(0,26) + '...';
    await db.query('UPDATE chatlist'+roomId+' SET lastmsg = $1 WHERE uid = $2' , [lastmsg,req.session.userId])
    if(roomId!==req.session.userId)
    await db.query('UPDATE chatlist'+req.session.userId+' SET lastmsg = $1 WHERE uid = $2' , [lastmsg,roomId])
    res.send({stat : ndc>0 ? nds : 'success' , dc: dc , ndc: ndc});
  }
  else{
    res.send({stat:'unauthorized access' ,dc:0 , ndc: 0})
  }
})

// TODO: listner
app.listen(PORT, async() =>{ 
  console.log('\server is running')
  var c = require('./client');
  c.connect();
  await c.query('CREATE TABLE IF NOT EXISTS userlist(user_id SERIAL PRIMARY KEY, name VARCHAR(50) , email VARCHAR(50) ,  password VARCHAR(25))' , (err,d) => {
  if(err){
  console.log(`arey yaar ${err}`);}
	  else c.end();
  });
});

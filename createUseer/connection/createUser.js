const User = require('../models/user'); 
const createUser=async function (req,res){

  
 try {
    const data = req.body   // get body from request

    const user = new User(data) // create mongoose document
    await user.save()           // save to database

    res.status(201).json({
      message: "User saved",
      user: user
    })

  } catch (error) {
    res.status(500).json({ error: error.message })
  }



  
}
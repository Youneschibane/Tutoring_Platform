const Counter = require('../models/counterModel');

async function getNextId(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },   // increment by 1
    { returnDocument: "after", upsert: true } // create if doesn't exist
  );
  return counter.seq;
}


module.exports = getNextId; 
const express = require('express');
const router  = express.Router();


module.exports = ({getAnswers}) => {
  // get all the answers from/ questions
  router.get('/:question_id', (res, req) => {

    getAnswers()
      .then(response => {
        console.log(response);
        res.send('h');
      })
      .catch((err)=> {
        console.log(err);
      });
  });
  return router;
};

/*
 * All routes for Users are defined here
 * Since this file is loaded in server.js into api/users,
 *   these routes are mounted onto /users
 * See: https://expressjs.com/en/guide/using-middleware.html#middleware.router
 */

const express = require('express');
const router  = express.Router();

module.exports = (db) => {
  // users/:user_id/quizzes/new GET - if logged in, take to new quizzes page
  router.get("/:user_id/quizzes/new", (req, res) => {
    res.render("new_quiz");
  });

  // users/:user_id/quizzes GET - goes to user all quizzes page, have all quizzes displayed in table
  router.get('/:user_id/quizzes', (req, res) => {
    
    db.getQuizzesByUserId(1)
      .then(quizzes => {
        // quizzes should be all the quiz that belongs to the user_id
        // given back as an array of objects
        const templateVars = {user_id: 1, quizzes: quizzes};
        // render page that will show all quizzes into table
        res.render("user_quizzes", templateVars);
      })
      .catch(e => res.send(e));
    
  });

  // users/:user_id/quizzes/:quiz_id GET - goes to quiz page with creator access
  router.get('/:user_id/quizzes/:quiz_id', (req, res) => {
    // Guest user for demo
    const user_id = 1;
    // get the quiz info
    const quiz_id = (req.params.quiz_id);
    db.getQuizWithQuizId(quiz_id)
      .then(quiz => {
        // quiz info here to render
        const templateVars = { quiz: quiz, user_id: user_id };
        // page rendering for quiz to be viewed by creator
        res.render('user_quiz', templateVars);
      })
      .catch(e => res.send(e));
    
  });

  // users/:user_id/quizzes/:quiz_id/edit GET - goes to quiz edit page with creator access
  router.get('/:user_id/quizzes/:quiz_id/edit', (req, res) => {
    const user_id = 1;
    const quiz_id = (req.params.quiz_id);
    db.getQuizWithQuizId(quiz_id)
      .then(quiz => {

        let orderQues = quiz.questions;
        orderQues.sort(function(a, b) {
          let keyA = a.question_id;
          let keyB = b.question_id;
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
          return 0;
        });

        // quiz info here to render
        const templateVars = { quiz: quiz, user_id: user_id };
        // render the page with the fields for edit
        res.render('user_quiz_edit', templateVars);
          
      })
      .catch(e => res.send(e));
    
  });

  // added visibility change to update quiz page
  // users/:user_id/quizzes/:quiz_id/edit POST - change visibility
  router.post('/:user_id/quizzes/:quiz_id/edit', (req, res) => {
    const quiz_id = req.params.quiz_id;
    db.editVisibility(quiz_id)
      .then(result => {
        res.redirect(`back`);
      })
      .catch(e => {
        res.status(500).send(e);
      });
  });

  // users/:user_id/quizzes/:quiz_id POST - update quiz info from edit page
  router.post('/:user_id/quizzes/:quiz_id', (req, res) => {

    // extract quiz_id from req params
    const user_id = 1;
    const quiz_id = req.params.quiz_id;
    
    // get quiz details to make newQuiz obj
    const newQuiz = {
      quizId : quiz_id,
      owner_id: user_id,
      title: req.body.title,
      description: req.body.description,
      photo_url: req.body.photo_url,
      category: req.body.category,
      visibility: req.body.visibility,
      questions: {}
    };

    // remove the keys from req.body
    delete req.body.title;
    delete req.body.description;
    delete req.body.photo_url;
    delete req.body.category;
    delete req.body.visibility;

    // Messy Creation of the new Quiz Object questions
    let formArray = Object.keys(req.body); //quiz_id
    // console.log(formArray)
    let questions = [];
    let answerVal = [];
    let count = 0;
    for (let i = 0; i < formArray.length; i ++) {
      if (formArray[i].split("A")[1]) {
        newQuiz.questions[formArray[i].split("Q")[1].split("A")[0]].answers[formArray[i].split("A")[1]] = [req.body[formArray[i]], false]; // add answer
      } else if (formArray[i].split("_")[1]) {
        newQuiz.questions[formArray[i].split("_")[1]].answers[req.body[formArray[i]]][1] = true; // add the correct answer
      } else {
        newQuiz.questions[formArray[i].split("Q")[1]] = { text : req.body[formArray[i]], answers : {}}; // add question
      }


    }
    
    db.editQuiz(newQuiz)
      .then(res.redirect(`/users/${user_id}/quizzes/${quiz_id}`))
      .catch(e => console.log(e));
    
  });

  // users/:user_id/quizzies/:quiz_id/delete - deletes quiz from quizzes db
  router.post('/:user_id/quizzes/:quiz_id/delete', (req, res) => {
    
    const quiz_id = Number(req.params.quiz_id);
    db.getQuizWithQuizId(quiz_id)
      .then(quiz => {
        db.removeQuiz(quiz.quiz_id)
          .then(result => {
            // redirect to user's quizzes page
            res.redirect(`../`);
          })
          .catch(e => res.send(e));
        
      });
    
  });

  return router;
};

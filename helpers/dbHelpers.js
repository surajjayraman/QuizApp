/*
 * All helper functions for Database access are defined here
 */
module.exports = (db) => {
  // fetches most popular public quizzes
  const getQuizzes = function(limit = 3, category) {
    let queryString = `
    SELECT quizzes.*, COUNT(attempts.*) AS total_attempt
    FROM quizzes
    LEFT JOIN attempts ON quiz_id = quizzes.id
    WHERE visibility = true`;
    if (category) {
      queryString += `WHERE category LIKE '%${category}%'`;
    }
    queryString += `
    GROUP BY quizzes.id
    ORDER BY total_attempt DESC
    LIMIT $1
    `;
    return db.query(queryString, [limit])
      .then(res => res.rows)
      .catch(err => {
        console.log(err.message);
      });

  };
  // get the answers from browser as answers
  const getAnswers = function(answers) {
    console.log(req.params);
    const question_id = req.params.question_id;

    let queryString  = `
    SELECT  quizzes.title,users.name, COUNT(answers.is_correct = 'TRUE')
    FROM answers JOIN questions
    ON  question_id = questions.id
    JOIN quizzes ON quiz_id = quizzes.id
    WHERE question_id=1
    GROUP BY quizzes.title;
    `;
  };
  // get a quiz by id
  const getQuizWithQuizId = function(quizId) {
    return db.query(`
    WITH ans AS (
      SELECT
      answers.question_id,
        json_agg(
          json_build_object(
            'answer_id', answers.id,
            'answer_value', answers.value,
            'answer_is_correct', answers.is_correct
          )
        ) AS answer
      FROM answers
      JOIN questions ON answers.question_id = questions.id
      JOIN quizzes ON questions.quiz_id = quizzes.id
      where quizzes.id = $1
    GROUP BY answers.question_id
    ), que AS (
      SELECT
        quiz_id,
        json_agg(
          json_build_object(
            'question_id', questions.id,
            'question', questions.question,
            'answers', ans.answer
          )
        ) AS question
      FROM questions
      JOIN ans ON questions.id = question_id
      GROUP BY quiz_id
    )
    SELECT
      json_build_object(
        'quiz', json_agg(
          json_build_object(
            'creator_id', users.id,
            'creator', users.name,
            'quiz_id', quizzes.id,
            'title', quizzes.title,
            'description', quizzes.description,
            'category', quizzes.category,
            'visibility', quizzes.visibility,
            'photo_url', quizzes.photo_url,
            'questions', que.question
          )
        )
      ) quizzes
    FROM quizzes
    JOIN que ON quizzes.id = quiz_id
    JOIN users ON owner_id = users.id;
    ;`, [quizId])
      .then(res => res.rows[0].quizzes.quiz[0]);
  }; //return something similar to JSON

  //get all attempts given a quizID
  const getAllAttempts = function(quizId) {
    return db.query(`
    WITH att AS (
      SELECT
        a.quiz_id,
        COUNT(DISTINCT que.*) question_amount,
        json_agg(
        json_build_object(
          'attempt_id', a.id,
          'attempt_on', a.attempt_on,
          'score', a.score,
          'user_id', a.user_id
          )
        ) AS attempt
      FROM attempts a
      JOIN questions que ON a.quiz_id = que.quiz_id
      WHERE a.quiz_id = $1
      GROUP BY a.quiz_id
    )
    SELECT
      json_build_object(
        'quiz', json_agg(
          json_build_object(
            'creator', u.name,
            'quiz_id', q.id,
            'title', q.title,
            'category', q.category,
            'photo_url', q.photo_url,
            'question_amount', att.question_amount,
            'attempts', att.attempt
          )
        )
      )
    FROM quizzes q
    JOIN att on q.id = quiz_id
    JOIN users u ON owner_id = u.id;
    `, [quizId])
      .then(res => res.rows);
  };

  //return all correct answers' answer_id with the question_id
  const getCorrectAnswer = function(quizId) {
    return db.query(`
    SELECT a.id answer_id, a.value correct_answer, que.id question_id
    FROM quizzes q
    JOIN questions que ON que.quiz_id = q.id
    JOIN answers a ON a.question_id = que.id
    WHERE q.id = $1 AND a.is_correct = TRUE;
    `, [quizId])
      .then(res => res.rows);
  };
  // will return Object of the newly added attempt with all info,
  // Info shall check if valid before using this function.
  const addAttempt = function(attempt) {
    let queryString = `INSERT INTO attempts(quiz_id, `;
    let queryParams = [parseInt(attempt.quizId)];
    if (attempt.user_id) { // check if there is a userId
      queryString += `user_id, `;
      queryParams.push(attempt.user_id); //yes then add userid too
    }
    queryString += `score)
    VALUES ($1, $2`;
    if (attempt.user_id) {
      queryString += `, $3`;
    }
    queryString += `)
    RETURNING *;`;
    queryParams.push(attempt.score);
    return db.query(queryString, queryParams)
      .then(res => res.rows[0]);
  };
  //get the attempt result with id
  const getAttempt =  function(attemptId) {
    return db.query(`
    SELECT attempt_on, attempts.id, attempts.score, users.name AS user, users.id AS attempter_id, quizzes.title AS quiz_title, quizzes.id as quiz_id, COUNT(questions.*) AS question_amount
    FROM attempts
    LEFT JOIN users ON user_id = users.id
    JOIN quizzes ON attempts.quiz_id = quizzes.id
    JOIN questions ON questions.quiz_id = quizzes.id
    WHERE attempts.id = $1
    GROUP BY 1, 2, 3, 4, 5, 6, 7;
    `, [attemptId])
      .then(res => res.rows[0]);
  }; // will return Object of the attempt.

  const addQuiz = function(quiz) {
    if (!quiz.visibility) quiz.visibility = "true";
    let queryString = `
      WITH quiz AS (
      INSERT INTO quizzes (owner_id, title, description, visibility, photo_url, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      )
      `; // use with to pass quizID for questions insert
    let queryParams = [ quiz.owner_id, quiz.title, quiz.description, quiz.visibility, quiz.photo_url, quiz.category ];
    for (let question = Object.keys(quiz.questions).length; question > 0; question--) {
      queryParams.push(quiz.questions[question].text);
      queryString += `, q${question} AS(
        INSERT INTO questions (quiz_id, question)
        SELECT quiz.id, $${queryParams.length}
        FROM   quiz
        RETURNING id
        )
        `; // pass questionID for answer insert
      for (let answer = Object.keys(quiz.questions[question].answers).length; answer > 0; answer--) {
        queryParams.push(quiz.questions[question].answers[answer][0]);
        queryString += `, q${question}a${answer} AS(
          INSERT INTO answers (question_id, value, is_correct)
          SELECT q${question}.id, $${queryParams.length}, $${queryParams.length + 1}
          FROM   q${question}
          )
          `;
        queryParams.push(quiz.questions[question].answers[answer][1]);
      }
    }
    queryString += `
    SELECT id
    FROM quiz
    ;`;
    return db.query(queryString, queryParams)
      .then(res => getQuizWithQuizId(res.rows[0].id)) //call upon getQuizWIthQuizId to return the whole quiz
      .catch(e => e);
  };

  // get all quiz from a certain user
  const getQuizzesByUserId = function(userId) {
    return db.query(`
    SELECT quizzes.id, users.name AS creator, users.id AS creator_id, quizzes.title, quizzes.description, quizzes.visibility, quizzes.photo_url, quizzes.category, COUNT(attempts.*) AS total_attempts, ROUND(AVG(attempts.score), 1) AS average_score
    FROM quizzes
    JOIN users ON owner_id = users.id
    LEFT JOIN attempts ON quiz_id = quizzes.id
    WHERE owner_id = $1
    GROUP BY quizzes.id, users.name, users.id
    ORDER BY quizzes.id DESC;
    `, [userId]) // this will shown newest first as default
      .then(res => res.rows);
  }; // will return array of Object containing all info from quiz table. Object Key [id, creator, title, description, visibilty, photo_url, category, total_attempts, average_score]

  //toggle visibility of quiz
  const editVisibility =  function(quizId) {
    return db.query(`
    UPDATE quizzes
    SET visibility = NOT visibility
    WHERE id = $1
    RETURNING *;
    `, [quizId])
      .then(res => res.rows[0]);
  }; // return the new visibility state of the quiz

  // will automatically call getQuizWithQuizId to return the updated quiz.
  // needs further testing
  const editQuiz =  function(newQuiz) {
    let queryString = `WITH`;
    let queryParams = [];
    let quesCount = Object.keys(newQuiz.questions).length; //since it no questions no long order from 1, get count
    let ansCount = -2;// counter start at negative untill condition hit
    for (const question in newQuiz.questions) {
      quesCount--;
      queryParams.push(newQuiz.questions[question].text);
      queryString += ` u${queryParams.length} AS (
      UPDATE questions
      SET question = $${queryParams.length}
      WHERE id = ${question}
      ),`;
      for (const answer in newQuiz.questions[question].answers) {
        if (quesCount === 0 && ansCount < 0) {
          ansCount = Object.keys(newQuiz.questions[question].answers).length - 1; //reset ansCoount for last question
        }
        if (ansCount === 0) { // if last answer, end the chain by not adding ,
          queryParams.push(newQuiz.questions[question].answers[answer][0]);
          queryString += ` u${queryParams.length} AS (
            UPDATE answers
            SET value = $${queryParams.length}, is_correct = $${queryParams.length + 1}
            WHERE id = ${answer}
            )`;
          queryParams.push(newQuiz.questions[question].answers[answer][1]);
        } else {
          queryParams.push(newQuiz.questions[question].answers[answer][0]);
          queryString += ` u${queryParams.length} AS (
            UPDATE answers
            SET value = $${queryParams.length}, is_correct = $${queryParams.length + 1}
            WHERE id = ${answer}
            ),`;
          queryParams.push(newQuiz.questions[question].answers[answer][1]);
        }
        ansCount--;
      }
    }
    queryString += `
    UPDATE quizzes
    SET title = $${queryParams.length + 1}, description = $${queryParams.length + 2}, visibility = $${queryParams.length + 3}, photo_url = $${queryParams.length + 4}, category = $${queryParams.length + 5}
    WHERE id = $${queryParams.length + 6}
    RETURNING *;
    `;
    queryParams.push(newQuiz.title, newQuiz.description, newQuiz.visibility, newQuiz.photo_url, newQuiz.category, newQuiz.quizId);
    return db.query(queryString, queryParams)
      .then(res => getQuizWithQuizId(res.rows[0].id));
  };

  // will return Object of the removed quiz with all info
  const removeQuiz =  function(quizId) {
    return db.query(`
    DELETE FROM quizzes CASCADE
    WHERE id = $1
    RETURNING *;
    `, [quizId])
      .then(res => res.rows[0]);
  };

  return {getQuizzes,
    getQuizWithQuizId,
    getAnswers,
    getAllAttempts,
    getCorrectAnswer,
    addAttempt,
    getAttempt,
    addQuiz,
    getQuizzesByUserId,
    editVisibility,
    editQuiz,
    removeQuiz};
};

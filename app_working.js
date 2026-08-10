import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const canvasCtx = canvas.getContext("2d");

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const exerciseSelect = document.getElementById("exerciseSelect");

const exerciseName = document.getElementById("exerciseName");
const countDisplay = document.getElementById("count");
const statusDisplay = document.getElementById("status");

let stream = null;
let poseLandmarker = null;
let drawingUtils = null;

let running = false;
let lastVideoTime = -1;

let repCount = 0;
let stage = null;
let lastCountTime = 0;

let angleHistory = [];


const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,

  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,

  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,

  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
};


// ==========================================
// ANGLE CALCULATION
// ==========================================

function calculateAngle(a, b, c) {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);

  let angle =
    Math.abs(radians * 180 / Math.PI);

  if (angle > 180) {
    angle = 360 - angle;
  }

  return angle;
}


// ==========================================
// SMOOTH ANGLE
// ==========================================

function smoothAngle(angle, windowSize = 4) {
  angleHistory.push(angle);

  if (angleHistory.length > windowSize) {
    angleHistory.shift();
  }

  let total = 0;

  for (const value of angleHistory) {
    total += value;
  }

  return total / angleHistory.length;
}


// ==========================================
// COOLDOWN
// ==========================================

function canCount(cooldownMs = 700) {
  const now = Date.now();

  if (now - lastCountTime >= cooldownMs) {
    lastCountTime = now;
    return true;
  }

  return false;
}


// ==========================================
// RESET
// ==========================================

function resetCounter() {
  repCount = 0;
  stage = null;

  lastCountTime = 0;
  angleHistory = [];

  countDisplay.textContent = "Count: 0";
}


// ==========================================
// SQUAT COUNTER
// ==========================================

function countSquat(landmarks) {
  const leftHip =
    landmarks[LANDMARKS.LEFT_HIP];

  const leftKnee =
    landmarks[LANDMARKS.LEFT_KNEE];

  const leftAnkle =
    landmarks[LANDMARKS.LEFT_ANKLE];


  const rightHip =
    landmarks[LANDMARKS.RIGHT_HIP];

  const rightKnee =
    landmarks[LANDMARKS.RIGHT_KNEE];

  const rightAnkle =
    landmarks[LANDMARKS.RIGHT_ANKLE];


  const leftAngle =
    calculateAngle(
      leftHip,
      leftKnee,
      leftAnkle
    );


  const rightAngle =
    calculateAngle(
      rightHip,
      rightKnee,
      rightAnkle
    );


  let angle =
    (leftAngle + rightAngle) / 2;


  angle =
    smoothAngle(angle, 4);


  // Initial standing position
  if (
    stage === null &&
    angle > 150
  ) {
    stage = "up";
  }


  // Going down
  if (
    stage === "up" &&
    angle < 110
  ) {
    stage = "down";
  }


  // Returning to standing
  if (
    stage === "down" &&
    angle > 145
  ) {

    if (canCount(700)) {

      repCount += 1;

      console.log(
        "Squat counted:",
        repCount
      );
    }

    stage = "up";
  }


  return {
    count: repCount,
    stage: stage,
    angle: angle
  };
}


// ==========================================
// PUSH-UP COUNTER
// ==========================================

function countPushup(landmarks) {
  const leftShoulder =
    landmarks[LANDMARKS.LEFT_SHOULDER];

  const leftElbow =
    landmarks[LANDMARKS.LEFT_ELBOW];

  const leftWrist =
    landmarks[LANDMARKS.LEFT_WRIST];


  const rightShoulder =
    landmarks[LANDMARKS.RIGHT_SHOULDER];

  const rightElbow =
    landmarks[LANDMARKS.RIGHT_ELBOW];

  const rightWrist =
    landmarks[LANDMARKS.RIGHT_WRIST];


  const leftAngle =
    calculateAngle(
      leftShoulder,
      leftElbow,
      leftWrist
    );


  const rightAngle =
    calculateAngle(
      rightShoulder,
      rightElbow,
      rightWrist
    );


  let angle =
    Math.min(
      leftAngle,
      rightAngle
    );


  angle =
    smoothAngle(angle, 4);


  // Initial top position
  if (
    stage === null &&
    angle > 145
  ) {
    stage = "up";
  }


  // Going down
  if (
    stage === "up" &&
    angle < 105
  ) {
    stage = "down";
  }


  // Returning up
  if (
    stage === "down" &&
    angle > 135
  ) {

    if (canCount(800)) {

      repCount += 1;

      console.log(
        "Push-up counted:",
        repCount
      );
    }

    stage = "up";
  }


  return {
    count: repCount,
    stage: stage,
    angle: angle
  };
}


// ==========================================
// CREATE MEDIAPIPE MODEL
// ==========================================

async function createPoseLandmarker() {
  statusDisplay.textContent =
    "Status: Loading pose model...";


  const vision =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );


  poseLandmarker =
    await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        },

        runningMode: "VIDEO",

        numPoses: 1,

        minPoseDetectionConfidence: 0.5,

        minPosePresenceConfidence: 0.5,

        minTrackingConfidence: 0.5
      }
    );


  drawingUtils =
    new DrawingUtils(
      canvasCtx
    );


  statusDisplay.textContent =
    "Status: Pose model ready";
}


// ==========================================
// EXERCISE SELECTION
// ==========================================

exerciseSelect.addEventListener(
  "change",
  () => {

    const selected =
      exerciseSelect.value;


    if (selected === "squat") {

      exerciseName.textContent =
        "Exercise: Squat";

    } else {

      exerciseName.textContent =
        "Exercise: Push-up";
    }


    resetCounter();


    statusDisplay.textContent =
      "Status: Ready";
  }
);


// ==========================================
// START CAMERA
// ==========================================

startButton.addEventListener(
  "click",
  async () => {

    try {

      if (!poseLandmarker) {

        await createPoseLandmarker();

      }


      if (stream) {

        stream
          .getTracks()
          .forEach(
            track => track.stop()
          );
      }


      stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              width: {
                ideal: 1280
              },

              height: {
                ideal: 720
              },

              facingMode:
                "user"
            },

            audio:
              false
          }
        );


      video.srcObject =
        stream;


      await video.play();


      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;


      running =
        true;


      lastVideoTime =
        -1;


      resetCounter();


      statusDisplay.textContent =
        "Status: Detecting pose";


      requestAnimationFrame(
        detectPose
      );

    }

    catch (error) {

      console.error(
        "Start error:",
        error
      );


      statusDisplay.textContent =
        "Status: Error - " +
        error.message;
    }
  }
);


// ==========================================
// DETECTION LOOP
// ==========================================

function detectPose() {
  if (!running) {
    return;
  }


  if (
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTime
  ) {

    lastVideoTime =
      video.currentTime;


    const result =
      poseLandmarker.detectForVideo(
        video,
        performance.now()
      );


    canvasCtx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    if (
      result.landmarks &&
      result.landmarks.length > 0
    ) {

      const landmarks =
        result.landmarks[0];


      // Draw skeleton
      drawingUtils.drawConnectors(
        landmarks,
        PoseLandmarker.POSE_CONNECTIONS,
        {
          lineWidth: 3
        }
      );


      drawingUtils.drawLandmarks(
        landmarks,
        {
          radius: 3
        }
      );


      const selectedExercise =
        exerciseSelect.value;


      let exerciseResult;


      if (
        selectedExercise === "squat"
      ) {

        exerciseResult =
          countSquat(
            landmarks
          );

      }

      else {

        exerciseResult =
          countPushup(
            landmarks
          );
      }


      countDisplay.textContent =
        `Count: ${exerciseResult.count}`;


      statusDisplay.textContent =
        `Stage: ${exerciseResult.stage ?? "waiting"} | ` +
        `Angle: ${exerciseResult.angle.toFixed(1)}°`;
    }

    else {

      statusDisplay.textContent =
        "Status: No body detected";
    }
  }


  requestAnimationFrame(
    detectPose
  );
}


// ==========================================
// STOP CAMERA
// ==========================================

stopButton.addEventListener(
  "click",
  () => {

    running =
      false;


    if (stream) {

      stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

      stream =
        null;
    }


    video.srcObject =
      null;


    canvasCtx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    statusDisplay.textContent =
      `Workout stopped - Final count: ${repCount}`;
  }
);
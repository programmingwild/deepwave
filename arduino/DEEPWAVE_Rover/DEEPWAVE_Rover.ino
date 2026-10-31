/*
 * DEEPWAVE bench rover — Arduino Uno sketch
 * ----------------------------------------
 * Hardware:
 *   - HC-SR04 ultrasonic (TRIG=D9, ECHO=D10)   -> simulates ROVER DEPTH / obstacle range
 *   - L298N (or any H-bridge) motor driver:
 *       ENA (speed) = D5 (PWM), IN1 = D7, IN2 = D8  -> simulates THRUSTER
 *   - 1 DC motor on OUT1/OUT2 of the driver
 *
 * Serial (9600 baud) output, one line per reading:
 *   dist_cm,motor_speed (0..255),state
 *   e.g. "12.4,180,FWD"
 *
 * Commands (send over serial):
 *   'F' forward, 'R' reverse, 'S' stop, 'A' auto-sweep (motor follows distance)
 *
 * Wiring:
 *   HC-SR04 VCC->5V, GND->GND, TRIG->D9, ECHO->D10
 *   L298N ENA->D5, IN1->D7, IN2->D8, VCC->5V (or 12V motor supply), GND->GND (common)
 *   Motor -> OUT1/OUT2
 *   (L298N: remove 5V-EN jumper if powering motor from external supply)
 */
const int TRIG = 9;
const int ECHO = 10;
const int ENA  = 5;
const int IN1  = 7;
const int IN2  = 8;

int motorSpeed = 0;   // 0..255
int motorDir   = 0;   // 1=fwd, -1=rev, 0=stop
bool autoMode  = false;

float readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long dur = pulseIn(ECHO, HIGH, 30000); // 30ms timeout
  if (dur == 0) return -1.0;
  return dur * 0.0343f / 2.0f;
}

void setMotor(int speed, int dir) {
  speed = constrain(speed, 0, 255);
  motorSpeed = speed;
  motorDir   = dir;
  if (dir > 0) { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); }
  else if (dir < 0) { digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH); }
  else { digitalWrite(IN1, LOW); digitalWrite(IN2, LOW); speed = 0; motorSpeed = 0; }
  analogWrite(ENA, speed);
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  setMotor(0, 0);
  Serial.println("DEEPWAVE ROVER READY");
}

void loop() {
  // handle commands
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'F') { autoMode = false; setMotor(180, 1); }
    else if (c == 'R') { autoMode = false; setMotor(180, -1); }
    else if (c == 'S') { autoMode = false; setMotor(0, 0); }
    else if (c == 'A') { autoMode = true; }
  }

  float d = readDistanceCm();

  // auto-sweep: motor speed scales with proximity (closer = slower, like a careful survey)
  if (autoMode && d > 0) {
    int sp = (int)map((long)d, 5, 60, 60, 200);
    sp = constrain(sp, 60, 200);
    setMotor(sp, 1);
  }

  const char* state = (motorDir > 0) ? "FWD" : (motorDir < 0) ? "REV" : "STOP";
  Serial.print(d, 1);
  Serial.print(",");
  Serial.print(motorSpeed);
  Serial.print(",");
  Serial.println(state);

  delay(200);
}

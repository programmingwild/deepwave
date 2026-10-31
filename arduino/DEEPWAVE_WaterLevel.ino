/*
 * DEEPWAVE — Water Level Monitor + Auto Pump
 * -----------------------------------------
 * Hardware:
 *   - HC-SR04 ultrasonic (TRIG=D9, ECHO=D10) mounted ABOVE the water surface
 *       measures distance to water → water level = TANK_HEIGHT - distance
 *   - L298N motor driver (pump): ENA=D5 (PWM), IN1=D7, IN2=D8
 *   - Optional: small DC water pump on OUT1/OUT2
 *
 * Serial (9600 baud) output, one line per reading:
 *   dist_cm,level_pct,pump_speed,state
 *   e.g. "8.5,72,200,RUNNING"
 *
 * Commands (send over serial):
 *   'P' pump ON (manual), 'O' pump OFF, 'A' auto mode (pump when level < threshold)
 *   'T' set tank height (send "T20" for 20 cm), 'L' set low threshold ("L30" = 30%)
 *
 * Wiring:
 *   HC-SR04 VCC->5V, GND->GND, TRIG->D9, ECHO->D10  (point down at water)
 *   L298N ENA->D5, IN1->D7, IN2->D8, VCC->5V/12V, GND->GND (common)
 *   Pump -> OUT1/OUT2
 */
const int TRIG = 9;
const int ECHO = 10;
const int ENA  = 5;
const int IN1  = 7;
const int IN2  = 8;

float tankHeightCm = 20.0;   // distance from sensor to tank bottom
int   lowThreshold  = 30;    // pump ON below this level %
int   highThreshold = 85;    // pump OFF above this level %
int   pumpSpeed     = 200;   // 0..255

int  pumpState = 0;          // 0=off, 1=running
bool autoMode  = true;
String cmdBuf = "";

float readDistanceCm() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long dur = pulseIn(ECHO, HIGH, 30000);
  if (dur == 0) return -1.0;
  return dur * 0.0343f / 2.0f;
}

void setPump(int on) {
  pumpState = on ? 1 : 0;
  if (on) { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); analogWrite(ENA, pumpSpeed); }
  else    { digitalWrite(IN1, LOW);  digitalWrite(IN2, LOW); analogWrite(ENA, 0); }
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(ENA, OUTPUT);  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  setPump(0);
  Serial.println("DEEPWAVE WATER LEVEL READY");
  Serial.print("TANK="); Serial.print(tankHeightCm); Serial.print(" LOW="); Serial.println(lowThreshold);
}

void handleCommand(String c) {
  c.trim();
  if (c.length() == 0) return;
  char head = c.charAt(0);
  if (head == 'P') { autoMode = false; setPump(1); }
  else if (head == 'O') { autoMode = false; setPump(0); }
  else if (head == 'A') { autoMode = true; }
  else if (head == 'T') { float v = c.substring(1).toFloat(); if (v > 0) tankHeightCm = v; }
  else if (head == 'L') { int v = c.substring(1).toInt(); if (v > 0 && v < 100) lowThreshold = v; }
  else if (head == 'H') { int v = c.substring(1).toInt(); if (v > 0 && v < 100) highThreshold = v; }
  else if (head == 'S') { pumpSpeed = c.substring(1).toInt(); pumpSpeed = constrain(pumpSpeed, 0, 255); }
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') { handleCommand(cmdBuf); cmdBuf = ""; }
    else if (ch != '\r') cmdBuf += ch;
  }

  float d = readDistanceCm();
  float level = -1;
  if (d > 0 && d <= tankHeightCm) level = (1.0 - (d / tankHeightCm)) * 100.0;
  level = constrain(level, 0, 100);

  // auto pump control
  if (autoMode && level >= 0) {
    if (level < lowThreshold && pumpState == 0) setPump(1);
    if (level > highThreshold && pumpState == 1) setPump(0);
  }

  const char* state = pumpState ? "PUMPING" : "IDLE";
  Serial.print(d, 1);
  Serial.print(",");
  Serial.print((int)level);
  Serial.print(",");
  Serial.print(pumpState ? pumpSpeed : 0);
  Serial.print(",");
  Serial.println(state);

  delay(300);
}

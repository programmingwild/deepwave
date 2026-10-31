/*
 * DEEPWAVE — Water Quality Node (pH + Turbidity + TDS + Level + Pump)
 * ------------------------------------------------------------------
 * Hardware (Arduino Uno):
 *   pH sensor analog out      -> A0   (DFRobot-style, 0-5V)
 *   Turbidity sensor analog   -> A1   (DFRobot SEN0189)
 *   TDS sensor analog out     -> A2   (DFRobot SEN0244)
 *   HC-SR04 TRIG              -> D9
 *   HC-SR04 ECHO              -> D10
 *   L298N ENA (pump speed)    -> D5 (PWM)
 *   L298N IN1 / IN2           -> D7 / D8
 *   Pump                      -> OUT1 / OUT2
 *
 * Serial (9600 baud) output, one line per reading:
 *   ph,turbidity_ntu,tds_mgL,waterLevel_cm,level_pct,pump_speed,state
 *   e.g. "7.42,4.8,178,8.5,57,0,IDLE"
 *
 * Commands:
 *   'P' pump ON, 'O' pump OFF, 'A' auto mode
 *   'T20' set tank height 20 cm, 'L30' low threshold 30%, 'H85' high 85%
 *   'C' calibrate pH (put probe in pH 7 buffer, then send 'C')
 *
 * NOTE: pH/turbidity/TDS formulas are approximate; calibrate against
 *       reference buffers for accurate readings.
 */
const int PIN_PH   = A0;
const int PIN_TURB = A1;
const int PIN_TDS  = A2;
const int TRIG = 9;
const int ECHO = 10;
const int ENA  = 5;
const int IN1  = 7;
const int IN2  = 8;

float tankHeightCm = 20.0;
int   lowThreshold  = 30;
int   highThreshold = 85;
int   pumpSpeed     = 200;
int   pumpState = 0;
bool  autoMode  = true;
String cmdBuf = "";

// pH calibration: voltage at pH 7 (measured in buffer)
float phOffset = 0.0;

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
  Serial.println("DEEPWAVE WATER QUALITY READY");
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
  else if (head == 'S') { pumpSpeed = constrain(c.substring(1).toInt(), 0, 255); }
  else if (head == 'C') { phOffset = analogRead(PIN_PH) * (5.0 / 1023.0); Serial.print("pH cal offset="); Serial.println(phOffset, 3); }
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') { handleCommand(cmdBuf); cmdBuf = ""; }
    else if (ch != '\r') cmdBuf += ch;
  }

  // --- pH ---
  int rawPh = analogRead(PIN_PH);
  float vPh = rawPh * (5.0 / 1023.0);
  float ph = 3.5 * vPh + phOffset;          // calibrate with 'C' in pH-7 buffer
  ph = constrain(ph, 0, 14);

  // --- Turbidity (DFRobot-ish curve) ---
  int rawTurb = analogRead(PIN_TURB);
  float vTurb = rawTurb * (5.0 / 1023.0);
  float turbidity = -1120.4 * vTurb * vTurb + 5742.3 * vTurb - 4352.9;
  if (turbidity < 0) turbidity = 0;
  if (turbidity > 3000) turbidity = 0;     // sensor not connected / saturated

  // --- TDS ---
  int rawTds = analogRead(PIN_TDS);
  float vTds = rawTds * (5.0 / 1023.0);
  float tds = (133.42 * vTds * vTds * vTds - 255.86 * vTds * vTds + 857.39 * vTds) * 0.5;
  if (tds < 0) tds = 0;

  // --- Water level ---
  float d = readDistanceCm();
  float level = -1;
  if (d > 0 && d <= tankHeightCm) level = (1.0 - (d / tankHeightCm)) * 100.0;
  level = constrain(level, 0, 100);

  // --- Auto pump ---
  if (autoMode && level >= 0) {
    if (level < lowThreshold && pumpState == 0) setPump(1);
    if (level > highThreshold && pumpState == 1) setPump(0);
  }

  const char* state = pumpState ? "PUMPING" : "IDLE";
  Serial.print(ph, 2);
  Serial.print(",");
  Serial.print(turbidity, 1);
  Serial.print(",");
  Serial.print((int)tds);
  Serial.print(",");
  Serial.print(d, 1);
  Serial.print(",");
  Serial.print((int)level);
  Serial.print(",");
  Serial.print(pumpState ? pumpSpeed : 0);
  Serial.print(",");
  Serial.println(state);

  delay(500);
}

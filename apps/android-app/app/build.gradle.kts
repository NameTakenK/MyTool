plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
  namespace = "com.mytool.wiki"; compileSdk = 34
  defaultConfig { applicationId = "com.mytool.wiki"; minSdk = 26; targetSdk = 34; versionCode = 1; versionName = "0.1.0" }
  buildFeatures { compose = true }
  composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }
}
dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.activity:activity-compose:1.9.1")
  implementation("androidx.compose.material3:material3:1.2.1")
}

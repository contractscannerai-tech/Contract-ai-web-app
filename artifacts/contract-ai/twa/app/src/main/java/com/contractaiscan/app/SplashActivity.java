package com.contractaiscan.app;

import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.preference.PreferenceManager;
import com.airbnb.lottie.LottieAnimationView;
import java.util.concurrent.Executor;

public class SplashActivity extends AppCompatActivity {

    private static final String PREF_BIOMETRIC_ENABLED = "biometric_lock_enabled";
    private static final int SPLASH_DELAY_MS = 1800;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        LottieAnimationView lottieView = findViewById(R.id.lottie_splash);
        if (lottieView != null) {
            lottieView.playAnimation();
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            boolean biometricEnabled = PreferenceManager
                    .getDefaultSharedPreferences(this)
                    .getBoolean(PREF_BIOMETRIC_ENABLED, false);

            if (biometricEnabled && isBiometricAvailable()) {
                showBiometricPrompt();
            } else {
                launchTwa();
            }
        }, SPLASH_DELAY_MS);
    }

    private boolean isBiometricAvailable() {
        BiometricManager manager = BiometricManager.from(this);
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private void showBiometricPrompt() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt.AuthenticationCallback callback =
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        launchTwa();
                    }

                    @Override
                    public void onAuthenticationFailed() {
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                                || errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                            finish();
                        }
                    }
                };

        BiometricPrompt prompt = new BiometricPrompt(this, executor, callback);
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.biometric_prompt_title))
                .setSubtitle(getString(R.string.biometric_prompt_subtitle))
                .setNegativeButtonText(getString(R.string.biometric_prompt_cancel))
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();

        prompt.authenticate(info);
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnectedOrConnecting();
    }

    private void launchTwa() {
        Intent intent = new Intent(this,
                com.google.androidbrowserhelper.trusted.LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }
}

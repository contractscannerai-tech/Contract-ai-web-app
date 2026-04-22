package com.contractaiscan.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.preference.PreferenceManager;
import java.util.concurrent.Executor;

public class SplashActivity extends AppCompatActivity {

    private static final String PREF_BIOMETRIC_ENABLED = "biometric_lock_enabled";
    private static final int SPLASH_DELAY_MS = 1600;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            // Full-screen immersive
            requestWindowFeature(Window.FEATURE_NO_TITLE);
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);

            // Build splash programmatically — no XML layout dependency
            FrameLayout root = new FrameLayout(this);
            root.setBackgroundColor(Color.parseColor("#0D0F1A"));

            LinearLayout center = new LinearLayout(this);
            center.setOrientation(LinearLayout.VERTICAL);
            center.setGravity(Gravity.CENTER);

            // App icon using the launcher icon resource
            ImageView icon = new ImageView(this);
            icon.setImageResource(R.mipmap.ic_launcher);
            int iconSize = dpToPx(120);
            LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(iconSize, iconSize);
            iconParams.gravity = Gravity.CENTER_HORIZONTAL;
            iconParams.bottomMargin = dpToPx(24);
            icon.setLayoutParams(iconParams);
            center.addView(icon);

            // App name
            TextView name = new TextView(this);
            name.setText("ContractAI");
            name.setTextColor(Color.WHITE);
            name.setTextSize(30f);
            name.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            name.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            nameParams.gravity = Gravity.CENTER_HORIZONTAL;
            name.setLayoutParams(nameParams);
            center.addView(name);

            // Purple underline accent
            View accent = new View(this);
            accent.setBackgroundColor(Color.parseColor("#7C3AED"));
            LinearLayout.LayoutParams accentParams = new LinearLayout.LayoutParams(dpToPx(80), dpToPx(3));
            accentParams.gravity = Gravity.CENTER_HORIZONTAL;
            accentParams.topMargin = dpToPx(8);
            accent.setLayoutParams(accentParams);
            center.addView(accent);

            FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            );
            center.setLayoutParams(centerParams);
            root.addView(center);

            setContentView(root);

        } catch (Exception e) {
            // If the programmatic layout fails for any reason, just show black screen
        }

        // Delay then proceed
        new Handler(Looper.getMainLooper()).postDelayed(this::checkAndProceed, SPLASH_DELAY_MS);
    }

    private void checkAndProceed() {
        try {
            if (!isNetworkAvailable()) {
                showNoInternetDialog();
                return;
            }

            boolean biometricEnabled = false;
            try {
                biometricEnabled = PreferenceManager
                    .getDefaultSharedPreferences(this)
                    .getBoolean(PREF_BIOMETRIC_ENABLED, false);
            } catch (Exception ignored) {}

            if (biometricEnabled && isBiometricAvailable()) {
                showBiometricPrompt();
            } else {
                launchTwa();
            }
        } catch (Exception e) {
            // If anything goes wrong in the check, still launch the TWA
            launchTwa();
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return true; // assume connected if we can't check

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.net.Network network = cm.getActiveNetwork();
                if (network == null) return false;
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                return caps != null && (
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            } else {
                NetworkInfo info = cm.getActiveNetworkInfo();
                return info != null && info.isConnectedOrConnecting();
            }
        } catch (Exception e) {
            return true; // assume connected on error
        }
    }

    private void showNoInternetDialog() {
        try {
            new AlertDialog.Builder(this)
                .setTitle("No Internet Connection")
                .setMessage("ContractAI requires an internet connection to load. Please check your Wi-Fi or mobile data and try again.")
                .setPositiveButton("Retry", (dialog, which) -> {
                    dialog.dismiss();
                    new Handler(Looper.getMainLooper()).postDelayed(this::checkAndProceed, 500);
                })
                .setNegativeButton("Exit", (dialog, which) -> {
                    dialog.dismiss();
                    finish();
                })
                .setCancelable(false)
                .show();
        } catch (Exception e) {
            launchTwa(); // fallback: just launch anyway
        }
    }

    private boolean isBiometricAvailable() {
        try {
            BiometricManager manager = BiometricManager.from(this);
            return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception e) {
            return false;
        }
    }

    private void showBiometricPrompt() {
        try {
            Executor executor = ContextCompat.getMainExecutor(this);
            BiometricPrompt.AuthenticationCallback callback =
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        launchTwa();
                    }
                    @Override
                    public void onAuthenticationFailed() {}
                    @Override
                    public void onAuthenticationError(int code, CharSequence msg) {
                        if (code == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            code == BiometricPrompt.ERROR_USER_CANCELED) {
                            finish();
                        } else {
                            launchTwa(); // on any other error, proceed anyway
                        }
                    }
                };

            BiometricPrompt prompt = new BiometricPrompt(this, executor, callback);
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Verify Identity")
                .setSubtitle("Use fingerprint or face to unlock ContractAI")
                .setNegativeButtonText("Cancel")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();

            prompt.authenticate(info);
        } catch (Exception e) {
            launchTwa(); // if biometric fails to show, proceed to app
        }
    }

    private void launchTwa() {
        try {
            Intent intent = new Intent(this,
                com.google.androidbrowserhelper.trusted.LauncherActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            finish();
        } catch (Exception e) {
            // Absolute last resort: open in browser
            try {
                Intent browser = new Intent(Intent.ACTION_VIEW,
                    android.net.Uri.parse("https://app--contractscanner.replit.app"));
                startActivity(browser);
                finish();
            } catch (Exception ignored) {
                finish();
            }
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}

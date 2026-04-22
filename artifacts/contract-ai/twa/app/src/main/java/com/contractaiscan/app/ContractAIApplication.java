package com.contractaiscan.app;

import android.app.Application;
import androidx.multidex.MultiDex;
import android.content.Context;

public class ContractAIApplication extends Application {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }

    @Override
    public void onCreate() {
        super.onCreate();
    }
}

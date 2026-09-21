package com.sakhi

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/** Bridges Android's built-in speech recognizer to JavaScript. */
class SpeechRecognitionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), RecognitionListener {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var listening = false

  override fun getName() = "SakhiSpeechRecognition"

  @ReactMethod
  fun start() {
    listening = true
    mainHandler.post { beginListening() }
  }

  @ReactMethod
  fun stop() {
    listening = false
    mainHandler.post {
      recognizer?.cancel()
      recognizer?.destroy()
      recognizer = null
    }
  }

  // Required by NativeEventEmitter so JS can manage this event source.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  private fun beginListening() {
    if (!listening || !SpeechRecognizer.isRecognitionAvailable(reactContext)) return
    if (recognizer == null) {
      recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).also {
        it.setRecognitionListener(this)
      }
    }
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    recognizer?.startListening(intent)
  }

  private fun restart() {
    if (listening) mainHandler.postDelayed({ beginListening() }, 250)
  }

  private fun emitTranscript(results: Bundle?) {
    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
    if (text.isEmpty()) return
    val payload = Arguments.createMap().apply { putString("text", text) }
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("SakhiSpeechTranscript", payload)
  }

  override fun onResults(results: Bundle?) { emitTranscript(results); restart() }
  override fun onError(error: Int) {
    val payload = Arguments.createMap().apply { putInt("code", error) }
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("SakhiSpeechError", payload)
    restart()
  }
  override fun onReadyForSpeech(params: Bundle?) = Unit
  override fun onBeginningOfSpeech() = Unit
  override fun onRmsChanged(rmsdB: Float) = Unit
  override fun onBufferReceived(buffer: ByteArray?) = Unit
  override fun onEndOfSpeech() = Unit
  override fun onPartialResults(partialResults: Bundle?) = Unit
  override fun onEvent(eventType: Int, params: Bundle?) = Unit
}

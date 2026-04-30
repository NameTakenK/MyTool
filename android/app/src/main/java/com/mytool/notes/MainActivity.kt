package com.mytool.notes

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.Html
import android.text.TextWatcher
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.documentfile.provider.DocumentFile
import java.io.BufferedReader
import java.io.InputStreamReader

class MainActivity : AppCompatActivity() {
  private lateinit var statusText: TextView
  private lateinit var noteList: ListView
  private lateinit var editor: EditText
  private lateinit var preview: TextView
  private lateinit var searchInput: EditText
  private lateinit var noteNameInput: EditText
  private lateinit var repoUrlInput: EditText

  private var vaultUri: Uri? = null
  private var currentDoc: DocumentFile? = null
  private var docs: List<DocumentFile> = emptyList()

  private val openTreeLauncher = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { result ->
    if (result.resultCode == Activity.RESULT_OK) {
      result.data?.data?.let { uri ->
        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        vaultUri = uri
        statusText.text = "Vault selected: $uri"
        refreshDocs()
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    statusText = findViewById(R.id.statusText)
    noteList = findViewById(R.id.noteList)
    editor = findViewById(R.id.editor)
    preview = findViewById(R.id.preview)
    searchInput = findViewById(R.id.searchInput)
    noteNameInput = findViewById(R.id.noteNameInput)
    repoUrlInput = findViewById(R.id.repoUrlInput)

    findViewById<Button>(R.id.openVaultBtn).setOnClickListener { pickVault() }
    findViewById<Button>(R.id.connectGithubBtn).setOnClickListener {
      val url = repoUrlInput.text.toString().trim()
      statusText.text = if (url.contains("github.com")) {
        "GitHub URL saved: $url (Android에서는 로컬 vault 기반으로 동작)"
      } else "유효한 GitHub URL을 입력하세요"
    }

    findViewById<Button>(R.id.newNoteBtn).setOnClickListener { createNote() }
    findViewById<Button>(R.id.saveBtn).setOnClickListener { saveCurrent() }

    noteList.setOnItemClickListener { _, _, position, _ ->
      val doc = docs[position]
      currentDoc = doc
      editor.setText(readDoc(doc))
      renderPreview(editor.text.toString())
      statusText.text = "Opened: ${doc.name}"
    }

    editor.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { renderPreview(s.toString()) }
      override fun afterTextChanged(s: Editable?) {}
    })

    searchInput.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { refreshDocs() }
      override fun afterTextChanged(s: Editable?) {}
    })
  }

  private fun pickVault() {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
    openTreeLauncher.launch(intent)
  }

  private fun refreshDocs() {
    val root = vaultUri?.let { DocumentFile.fromTreeUri(this, it) } ?: return
    val query = searchInput.text.toString().trim().lowercase()

    docs = root.listFiles().filter { it.isFile && (it.name?.endsWith(".md") == true) }
      .filter { query.isBlank() || (it.name?.lowercase()?.contains(query) == true) }
      .sortedBy { it.name }

    noteList.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, docs.map { it.name ?: "(unnamed)" })
  }

  private fun createNote() {
    val root = vaultUri?.let { DocumentFile.fromTreeUri(this, it) } ?: return
    val base = noteNameInput.text.toString().trim().ifBlank { "Untitled" }
    val name = if (base.endsWith(".md")) base else "$base.md"
    val doc = root.createFile("text/markdown", name.removeSuffix(".md")) ?: return
    contentResolver.openOutputStream(doc.uri)?.use { it.write("# New Note\n".toByteArray()) }
    statusText.text = "Created: ${doc.name}"
    refreshDocs()
  }

  private fun saveCurrent() {
    val doc = currentDoc ?: return
    contentResolver.openOutputStream(doc.uri, "wt")?.use { it.write(editor.text.toString().toByteArray()) }
    statusText.text = "Saved: ${doc.name}"
  }

  private fun readDoc(doc: DocumentFile): String {
    return contentResolver.openInputStream(doc.uri)?.use { stream ->
      BufferedReader(InputStreamReader(stream)).readText()
    } ?: ""
  }

  private fun renderPreview(md: String) {
    val html = md
      .replace(Regex("^### (.*)$", RegexOption.MULTILINE), "<h3>$1</h3>")
      .replace(Regex("^## (.*)$", RegexOption.MULTILINE), "<h2>$1</h2>")
      .replace(Regex("^# (.*)$", RegexOption.MULTILINE), "<h1>$1</h1>")
      .replace(Regex("\\*\\*(.*?)\\*\\*"), "<b>$1</b>")
      .replace(Regex("\\*(.*?)\\*"), "<i>$1</i>")
      .replace("\n", "<br/>")
    preview.text = Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY)
  }
}

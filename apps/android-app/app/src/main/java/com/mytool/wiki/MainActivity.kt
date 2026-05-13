package com.mytool.wiki
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*

class MainActivity: ComponentActivity(){ override fun onCreate(savedInstanceState: Bundle?){ super.onCreate(savedInstanceState); setContent{ App() } } }
@Composable fun App(){ var idx by remember{ mutableStateOf(0) }; val tabs=listOf("Files","Graph","Ask","Settings"); Scaffold(bottomBar={ NavigationBar { tabs.forEachIndexed{i,t-> NavigationBarItem(selected=idx==i,onClick={idx=i},label={Text(t)},icon={}) } } }){ p-> Text("$idx: ${tabs[idx]}", modifier= androidx.compose.ui.Modifier.padding(p)) } }

# Multi-Server HTTP Chat Application
###### Teknik Informatika - Universitas Katolik Parahyangan

Kontributor:
* Yohanes Mario Chandra (2011730031)
* Aswin Sebastian Hanes (2011730059)
* Reanta Indra Putra Pratama (2011730079)

Dependency:
* Node.js (https://nodejs.org)

Aplikasi chat multi-server ini dibuat dalam rangka memenuhi tugas mata kuliah SAT (2015-1). Seluruh dokumen yang berkaitan dengan tugas ini dapat dilihat pada folder `/docs`. File config berada pada folder root directory (`/`). Cara penggunaannya dapat dilihat pada dokumen tugas.

Cara mengaktifkan server adalah dengan menjalankan perintah:

    node server.js serverX.cfg

X adalah nomor server. Penjelasan lebih lanjut dapat dibaca di dokumen tugas.

TO-DO:
 - [x] Telnet c2s. `/node_modules/app/c2s/telnetServer.js`
    - [x] login
    - [x] logout
    - [x] chatPull (beda algoritma dengan http)
    - [x] chatSend
    - [x] chatGet
    - [x] register
 - [x] Telnet port. (look at server1.cfg)
 - [ ] Multiple serverHook. (priority based)
 - [ ] Dedicated connection for s2s (using 'net' api).

Aplikasi server berada pada direktori `/node_modules/app`, dan aplikasi client berada pada direktori `/webroot`. Aplikasi client dapat dibuka menggunakan browser pada `http://ip:port`.
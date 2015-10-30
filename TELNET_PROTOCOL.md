# TELNET PROTOCOL

### List Command

* Register:
    * `register;username;password`
    * return:
        * `{accepted}`

            atau

        * `{rejected} message_dari_server`
* Login:
    * `login;username;password`
    * return:
        * `{accepted}`

            atau

        * `{rejected} message_dari_server`
* Logout:
    * `logout`
    * return:
        * `{accepted}`

            `{connection is closed}`

            atau

        * `{rejected} message_dari_server`
* Exit (kalau belum login tapi mau disconnect):
    * `exit`
    * return:
        * `{connection is closed}`
* ChatSend:
    * `chatsend;text_yang_mau_dikirim`
    * return:
        * `{accepted}`

            atau

        * `{rejected} message_dari_server`
* ChatGet:
    * `chatget;last_timestamp`
    * return:
        * `{accepted}`

            `[timestamp] <sender>: message_content`

            `[timestamp] <sender>: message_content`

            dst...

            atau

        * `{rejected} message_dari_server`

Setiap command selalu diakhiri dengan `\n` atau `\r\n`. Misal, untuk login: `login;username;password\n` atau `login;username;password\r\n`.

Spasi antar `;` tidak menjadi masalah. Misal, `chatsend;test` sama dengan `chatsend ; test`.

Karena `;` digunakan sebagai delimiter, maka penulisan `;` dalam teks perlu diubah dulu menjadi `\;`.

### Format Pesan Dari Server

Untuk message dari server seperti `accepted`, `rejected`, atau `connection is closed` selalu dibungkus menggunakan `{}`. Khusus untuk message `rejected` dapat diikuti dengan message lainnya yang dapat ditampilkan ke user, misalnya: `{rejected} session expired`.

Untuk message mengenai chat akan diterima dalam format:

    [timestamp] <sender>: message_content

Ada beberapa error message yang akan selalu diawali dengan string `Error:`.

#### Langkah-langkah Parsing

1. Periksa apakah pesan diawali oleh string `Error:`.
    - Jika ya, tampilkan pesan error tersebut.
2. Periksa apakah pesan diawali dengan `{`.
    - Jika ya, baca sampai menemukan `}`, lalu periksa apakah pesan tersebut adalah:
        - `{accepted}`,
        - `{rejected}` atau,
        - `{connection is closed}`.
    - Khusus untuk rejected, lanjutkan membaca sampai menemukan `\n` atau `\r\n`. Itu adalah pesan yang dapat ditampilkan ke user.
3. Periksa apakah pesan diawali oleh `[`.
    - Jika ya, maka pesan tersebut adalah chat message. Parsing chat message dapat dilakukan dengan membuang `[`, lalu melakukan split string pada bagian `] <` dan `>:`.

### TO-DO List Telnet

 - [ ] Tambah perintah `serversubscribe` untuk mendapatkan pesan mengenai registrasi server baru. Digunakan untuk mengupdate list server di client java. Tidak perlu login(?)
 - [ ] Tambah perintah `listloggedin` untuk mendapatkan list awal siapa saja yang sudah login. Perlu login dahulu.

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
* ServerSubscribe (untuk mendapatkan list server):
    * `serversubscribe`
    * return:
        * `{accepted}`

            `Server: ip:port`

            `Server: ip:port`

            dst...

            atau

        * `{rejected} message_dari_server`
* ListLoggedIn (untuk mendapatkan list user yang sedang login):
    * `listloggedin`
    * return:
        * `{accepted}`

            `<username>: logged-in`

            `<username>: logged-in`

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

Untuk message mengenai user yang login atau logout:

    <username>: logged-in

    atau

    <username>: logged-out

Ada beberapa error message yang akan selalu diawali dengan string `Error:`.

#### Langkah-langkah Parsing

1. Periksa apakah pesan diawali oleh string `Error:`.
    - Jika ya, tampilkan pesan error tersebut.
2. Periksa apakah pesan diawali oleh string `Server:`.
    - Jika ya, masukkan server tersebut ke dalam daftar server.
3. Periksa apakah pesan diawali dengan `{`.
    - Jika ya, baca sampai menemukan `}`, lalu periksa apakah pesan tersebut adalah:
        - `{accepted}`,
        - `{rejected}` atau,
        - `{connection is closed}`.
    - Khusus untuk rejected, lanjutkan membaca sampai menemukan `\n` atau `\r\n`. Itu adalah pesan yang dapat ditampilkan ke user.
4. Periksa apakah pesan diawali oleh `[`.
    - Jika ya, maka pesan tersebut adalah chat message. Parsing chat message dapat dilakukan dengan membuang `[`, lalu melakukan split string pada bagian `] <` dan `>:`.
5. Periksa apakah pesan diawali oleh `<`.
    - Jika ya, baca sampai menemukan `>`, itu adalah username.
    - Jika setelah `>` adalah `: logged-in`, maka masukkan ke dalam daftar user yang sedang login.
    - Jika `: logged-out`, buang dari daftar.

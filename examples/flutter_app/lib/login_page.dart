import 'package:flutter/material.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(16, 24, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ログイン', style: TextStyle(fontSize: 20)),
          SizedBox(height: 16),
          Text('メールアドレス', style: TextStyle(fontSize: 14)),
          SizedBox(height: 8),
          Text('パスワード', style: TextStyle(fontSize: 14)),
        ],
      ),
    );
  }
}

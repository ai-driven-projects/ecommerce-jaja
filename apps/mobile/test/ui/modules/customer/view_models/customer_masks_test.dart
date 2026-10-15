import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/customer/view_models/customer_masks.dart';

void main() {
  group('formatCpfInput', () {
    test('mascara o texto parcial conforme a digitação', () {
      expect(formatCpfInput(''), '');
      expect(formatCpfInput('529'), '529');
      expect(formatCpfInput('5299'), '529.9');
      expect(formatCpfInput('529982'), '529.982');
      expect(formatCpfInput('5299822'), '529.982.2');
      expect(formatCpfInput('529982247'), '529.982.247');
      expect(formatCpfInput('5299822472'), '529.982.247-2');
    });

    test('11 dígitos viram 000.000.000-00, com ou sem máscara na entrada', () {
      expect(formatCpfInput('52998224725'), '529.982.247-25');
      expect(formatCpfInput('529.982.247-25'), '529.982.247-25');
    });

    test('ignora o que não é dígito e o que passa de 11 dígitos', () {
      expect(formatCpfInput('529a982 247-25'), '529.982.247-25');
      expect(formatCpfInput('529982247251'), '529.982.247-25');
    });
  });

  group('formatPhoneInput', () {
    test('mascara o texto parcial conforme a digitação', () {
      expect(formatPhoneInput(''), '');
      expect(formatPhoneInput('8'), '(8');
      expect(formatPhoneInput('85'), '(85');
      expect(formatPhoneInput('859'), '(85) 9');
      expect(formatPhoneInput('859999'), '(85) 9999');
      expect(formatPhoneInput('8599999'), '(85) 9999-9');
    });

    test('10 dígitos viram (00) 0000-0000', () {
      expect(formatPhoneInput('8532221111'), '(85) 3222-1111');
    });

    test('11 dígitos viram (00) 00000-0000, com ou sem máscara na entrada', () {
      expect(formatPhoneInput('85999998888'), '(85) 99999-8888');
      expect(formatPhoneInput('(85) 99999-8888'), '(85) 99999-8888');
    });

    test('mais de 11 dígitos ficam só com os dígitos, sem máscara', () {
      expect(formatPhoneInput('5585999998888'), '5585999998888');
      expect(formatPhoneInput('+55 (85) 99999-8888'), '5585999998888');
    });
  });

  group('formatZipCodeInput', () {
    test('mascara o texto parcial conforme a digitação', () {
      expect(formatZipCodeInput(''), '');
      expect(formatZipCodeInput('60150'), '60150');
      expect(formatZipCodeInput('601501'), '60150-1');
    });

    test('8 dígitos viram 00000-000 e o excesso é ignorado', () {
      expect(formatZipCodeInput('60150160'), '60150-160');
      expect(formatZipCodeInput('60150-160'), '60150-160');
      expect(formatZipCodeInput('601501609'), '60150-160');
    });
  });
}

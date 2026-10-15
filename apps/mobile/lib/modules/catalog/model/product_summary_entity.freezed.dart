// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_summary_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$ProductSummary {

 String get id; String get slug; String get name; String? get brandName; String get categoryName; String get rootCategorySlug; Money get price; Money? get listPrice; int? get discountPercent; String get unit; String? get thumbUrl; bool get isFeatured;
/// Create a copy of ProductSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductSummaryCopyWith<ProductSummary> get copyWith => _$ProductSummaryCopyWithImpl<ProductSummary>(this as ProductSummary, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.brandName, brandName) || other.brandName == brandName)&&(identical(other.categoryName, categoryName) || other.categoryName == categoryName)&&(identical(other.rootCategorySlug, rootCategorySlug) || other.rootCategorySlug == rootCategorySlug)&&(identical(other.price, price) || other.price == price)&&(identical(other.listPrice, listPrice) || other.listPrice == listPrice)&&(identical(other.discountPercent, discountPercent) || other.discountPercent == discountPercent)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured));
}


@override
int get hashCode => Object.hash(runtimeType,id,slug,name,brandName,categoryName,rootCategorySlug,price,listPrice,discountPercent,unit,thumbUrl,isFeatured);

@override
String toString() {
  return 'ProductSummary(id: $id, slug: $slug, name: $name, brandName: $brandName, categoryName: $categoryName, rootCategorySlug: $rootCategorySlug, price: $price, listPrice: $listPrice, discountPercent: $discountPercent, unit: $unit, thumbUrl: $thumbUrl, isFeatured: $isFeatured)';
}


}

/// @nodoc
abstract mixin class $ProductSummaryCopyWith<$Res>  {
  factory $ProductSummaryCopyWith(ProductSummary value, $Res Function(ProductSummary) _then) = _$ProductSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String slug, String name, String? brandName, String categoryName, String rootCategorySlug, Money price, Money? listPrice, int? discountPercent, String unit, String? thumbUrl, bool isFeatured
});




}
/// @nodoc
class _$ProductSummaryCopyWithImpl<$Res>
    implements $ProductSummaryCopyWith<$Res> {
  _$ProductSummaryCopyWithImpl(this._self, this._then);

  final ProductSummary _self;
  final $Res Function(ProductSummary) _then;

/// Create a copy of ProductSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? slug = null,Object? name = null,Object? brandName = freezed,Object? categoryName = null,Object? rootCategorySlug = null,Object? price = null,Object? listPrice = freezed,Object? discountPercent = freezed,Object? unit = null,Object? thumbUrl = freezed,Object? isFeatured = null,}) {
  return _then(ProductSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,brandName: freezed == brandName ? _self.brandName : brandName // ignore: cast_nullable_to_non_nullable
as String?,categoryName: null == categoryName ? _self.categoryName : categoryName // ignore: cast_nullable_to_non_nullable
as String,rootCategorySlug: null == rootCategorySlug ? _self.rootCategorySlug : rootCategorySlug // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as Money,listPrice: freezed == listPrice ? _self.listPrice : listPrice // ignore: cast_nullable_to_non_nullable
as Money?,discountPercent: freezed == discountPercent ? _self.discountPercent : discountPercent // ignore: cast_nullable_to_non_nullable
as int?,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ProductSummary].
extension ProductSummaryPatterns on ProductSummary {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductSummary() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductSummary value)  $default,){
final _that = this;
switch (_that) {
case _ProductSummary():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductSummary value)?  $default,){
final _that = this;
switch (_that) {
case _ProductSummary() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String slug,  String name,  String? brandName,  String categoryName,  String rootCategorySlug,  Money price,  Money? listPrice,  int? discountPercent,  String unit,  String? thumbUrl,  bool isFeatured)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductSummary() when $default != null:
return $default(_that.id,_that.slug,_that.name,_that.brandName,_that.categoryName,_that.rootCategorySlug,_that.price,_that.listPrice,_that.discountPercent,_that.unit,_that.thumbUrl,_that.isFeatured);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String slug,  String name,  String? brandName,  String categoryName,  String rootCategorySlug,  Money price,  Money? listPrice,  int? discountPercent,  String unit,  String? thumbUrl,  bool isFeatured)  $default,) {final _that = this;
switch (_that) {
case _ProductSummary():
return $default(_that.id,_that.slug,_that.name,_that.brandName,_that.categoryName,_that.rootCategorySlug,_that.price,_that.listPrice,_that.discountPercent,_that.unit,_that.thumbUrl,_that.isFeatured);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String slug,  String name,  String? brandName,  String categoryName,  String rootCategorySlug,  Money price,  Money? listPrice,  int? discountPercent,  String unit,  String? thumbUrl,  bool isFeatured)?  $default,) {final _that = this;
switch (_that) {
case _ProductSummary() when $default != null:
return $default(_that.id,_that.slug,_that.name,_that.brandName,_that.categoryName,_that.rootCategorySlug,_that.price,_that.listPrice,_that.discountPercent,_that.unit,_that.thumbUrl,_that.isFeatured);case _:
  return null;

}
}

}

/// @nodoc


class _ProductSummary implements ProductSummary {
  const _ProductSummary({required this.id, required this.slug, required this.name, required this.brandName, required this.categoryName, required this.rootCategorySlug, required this.price, required this.listPrice, required this.discountPercent, required this.unit, required this.thumbUrl, required this.isFeatured});
  

@override final  String id;
@override final  String slug;
@override final  String name;
@override final  String? brandName;
@override final  String categoryName;
@override final  String rootCategorySlug;
@override final  Money price;
@override final  Money? listPrice;
@override final  int? discountPercent;
@override final  String unit;
@override final  String? thumbUrl;
@override final  bool isFeatured;

/// Create a copy of ProductSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductSummaryCopyWith<_ProductSummary> get copyWith => __$ProductSummaryCopyWithImpl<_ProductSummary>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.brandName, brandName) || other.brandName == brandName)&&(identical(other.categoryName, categoryName) || other.categoryName == categoryName)&&(identical(other.rootCategorySlug, rootCategorySlug) || other.rootCategorySlug == rootCategorySlug)&&(identical(other.price, price) || other.price == price)&&(identical(other.listPrice, listPrice) || other.listPrice == listPrice)&&(identical(other.discountPercent, discountPercent) || other.discountPercent == discountPercent)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.isFeatured, isFeatured) || other.isFeatured == isFeatured));
}


@override
int get hashCode => Object.hash(runtimeType,id,slug,name,brandName,categoryName,rootCategorySlug,price,listPrice,discountPercent,unit,thumbUrl,isFeatured);

@override
String toString() {
  return 'ProductSummary(id: $id, slug: $slug, name: $name, brandName: $brandName, categoryName: $categoryName, rootCategorySlug: $rootCategorySlug, price: $price, listPrice: $listPrice, discountPercent: $discountPercent, unit: $unit, thumbUrl: $thumbUrl, isFeatured: $isFeatured)';
}


}

/// @nodoc
abstract mixin class _$ProductSummaryCopyWith<$Res> implements $ProductSummaryCopyWith<$Res> {
  factory _$ProductSummaryCopyWith(_ProductSummary value, $Res Function(_ProductSummary) _then) = __$ProductSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String slug, String name, String? brandName, String categoryName, String rootCategorySlug, Money price, Money? listPrice, int? discountPercent, String unit, String? thumbUrl, bool isFeatured
});




}
/// @nodoc
class __$ProductSummaryCopyWithImpl<$Res>
    implements _$ProductSummaryCopyWith<$Res> {
  __$ProductSummaryCopyWithImpl(this._self, this._then);

  final _ProductSummary _self;
  final $Res Function(_ProductSummary) _then;

/// Create a copy of ProductSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? slug = null,Object? name = null,Object? brandName = freezed,Object? categoryName = null,Object? rootCategorySlug = null,Object? price = null,Object? listPrice = freezed,Object? discountPercent = freezed,Object? unit = null,Object? thumbUrl = freezed,Object? isFeatured = null,}) {
  return _then(_ProductSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,brandName: freezed == brandName ? _self.brandName : brandName // ignore: cast_nullable_to_non_nullable
as String?,categoryName: null == categoryName ? _self.categoryName : categoryName // ignore: cast_nullable_to_non_nullable
as String,rootCategorySlug: null == rootCategorySlug ? _self.rootCategorySlug : rootCategorySlug // ignore: cast_nullable_to_non_nullable
as String,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as Money,listPrice: freezed == listPrice ? _self.listPrice : listPrice // ignore: cast_nullable_to_non_nullable
as Money?,discountPercent: freezed == discountPercent ? _self.discountPercent : discountPercent // ignore: cast_nullable_to_non_nullable
as int?,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,isFeatured: null == isFeatured ? _self.isFeatured : isFeatured // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on

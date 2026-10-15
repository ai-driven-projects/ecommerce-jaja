// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_query.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$ProductQuery {

 int? get page; int? get pageSize; String? get search; String? get categorySlug; List<String> get brandSlugs; int? get minPriceCents; int? get maxPriceCents; bool get onSale; bool get featured; ProductSort? get sort;
/// Create a copy of ProductQuery
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductQueryCopyWith<ProductQuery> get copyWith => _$ProductQueryCopyWithImpl<ProductQuery>(this as ProductQuery, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductQuery&&(identical(other.page, page) || other.page == page)&&(identical(other.pageSize, pageSize) || other.pageSize == pageSize)&&(identical(other.search, search) || other.search == search)&&(identical(other.categorySlug, categorySlug) || other.categorySlug == categorySlug)&&const DeepCollectionEquality().equals(other.brandSlugs, brandSlugs)&&(identical(other.minPriceCents, minPriceCents) || other.minPriceCents == minPriceCents)&&(identical(other.maxPriceCents, maxPriceCents) || other.maxPriceCents == maxPriceCents)&&(identical(other.onSale, onSale) || other.onSale == onSale)&&(identical(other.featured, featured) || other.featured == featured)&&(identical(other.sort, sort) || other.sort == sort));
}


@override
int get hashCode => Object.hash(runtimeType,page,pageSize,search,categorySlug,const DeepCollectionEquality().hash(brandSlugs),minPriceCents,maxPriceCents,onSale,featured,sort);

@override
String toString() {
  return 'ProductQuery(page: $page, pageSize: $pageSize, search: $search, categorySlug: $categorySlug, brandSlugs: $brandSlugs, minPriceCents: $minPriceCents, maxPriceCents: $maxPriceCents, onSale: $onSale, featured: $featured, sort: $sort)';
}


}

/// @nodoc
abstract mixin class $ProductQueryCopyWith<$Res>  {
  factory $ProductQueryCopyWith(ProductQuery value, $Res Function(ProductQuery) _then) = _$ProductQueryCopyWithImpl;
@useResult
$Res call({
 int? page, int? pageSize, String? search, String? categorySlug, List<String> brandSlugs, int? minPriceCents, int? maxPriceCents, bool onSale, bool featured, ProductSort? sort
});




}
/// @nodoc
class _$ProductQueryCopyWithImpl<$Res>
    implements $ProductQueryCopyWith<$Res> {
  _$ProductQueryCopyWithImpl(this._self, this._then);

  final ProductQuery _self;
  final $Res Function(ProductQuery) _then;

/// Create a copy of ProductQuery
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? page = freezed,Object? pageSize = freezed,Object? search = freezed,Object? categorySlug = freezed,Object? brandSlugs = null,Object? minPriceCents = freezed,Object? maxPriceCents = freezed,Object? onSale = null,Object? featured = null,Object? sort = freezed,}) {
  return _then(ProductQuery(
page: freezed == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int?,pageSize: freezed == pageSize ? _self.pageSize : pageSize // ignore: cast_nullable_to_non_nullable
as int?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,categorySlug: freezed == categorySlug ? _self.categorySlug : categorySlug // ignore: cast_nullable_to_non_nullable
as String?,brandSlugs: null == brandSlugs ? _self.brandSlugs : brandSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,minPriceCents: freezed == minPriceCents ? _self.minPriceCents : minPriceCents // ignore: cast_nullable_to_non_nullable
as int?,maxPriceCents: freezed == maxPriceCents ? _self.maxPriceCents : maxPriceCents // ignore: cast_nullable_to_non_nullable
as int?,onSale: null == onSale ? _self.onSale : onSale // ignore: cast_nullable_to_non_nullable
as bool,featured: null == featured ? _self.featured : featured // ignore: cast_nullable_to_non_nullable
as bool,sort: freezed == sort ? _self.sort : sort // ignore: cast_nullable_to_non_nullable
as ProductSort?,
  ));
}

}


/// Adds pattern-matching-related methods to [ProductQuery].
extension ProductQueryPatterns on ProductQuery {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductQuery value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductQuery() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductQuery value)  $default,){
final _that = this;
switch (_that) {
case _ProductQuery():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductQuery value)?  $default,){
final _that = this;
switch (_that) {
case _ProductQuery() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? page,  int? pageSize,  String? search,  String? categorySlug,  List<String> brandSlugs,  int? minPriceCents,  int? maxPriceCents,  bool onSale,  bool featured,  ProductSort? sort)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductQuery() when $default != null:
return $default(_that.page,_that.pageSize,_that.search,_that.categorySlug,_that.brandSlugs,_that.minPriceCents,_that.maxPriceCents,_that.onSale,_that.featured,_that.sort);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? page,  int? pageSize,  String? search,  String? categorySlug,  List<String> brandSlugs,  int? minPriceCents,  int? maxPriceCents,  bool onSale,  bool featured,  ProductSort? sort)  $default,) {final _that = this;
switch (_that) {
case _ProductQuery():
return $default(_that.page,_that.pageSize,_that.search,_that.categorySlug,_that.brandSlugs,_that.minPriceCents,_that.maxPriceCents,_that.onSale,_that.featured,_that.sort);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? page,  int? pageSize,  String? search,  String? categorySlug,  List<String> brandSlugs,  int? minPriceCents,  int? maxPriceCents,  bool onSale,  bool featured,  ProductSort? sort)?  $default,) {final _that = this;
switch (_that) {
case _ProductQuery() when $default != null:
return $default(_that.page,_that.pageSize,_that.search,_that.categorySlug,_that.brandSlugs,_that.minPriceCents,_that.maxPriceCents,_that.onSale,_that.featured,_that.sort);case _:
  return null;

}
}

}

/// @nodoc


class _ProductQuery implements ProductQuery {
  const _ProductQuery({this.page, this.pageSize, this.search, this.categorySlug,  List<String> brandSlugs = const [], this.minPriceCents, this.maxPriceCents, this.onSale = false, this.featured = false, this.sort}): _brandSlugs = brandSlugs;
  

@override final  int? page;
@override final  int? pageSize;
@override final  String? search;
@override final  String? categorySlug;
 final  List<String> _brandSlugs;
@override@JsonKey() List<String> get brandSlugs {
  if (_brandSlugs is EqualUnmodifiableListView) return _brandSlugs;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_brandSlugs);
}

@override final  int? minPriceCents;
@override final  int? maxPriceCents;
@override@JsonKey() final  bool onSale;
@override@JsonKey() final  bool featured;
@override final  ProductSort? sort;

/// Create a copy of ProductQuery
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductQueryCopyWith<_ProductQuery> get copyWith => __$ProductQueryCopyWithImpl<_ProductQuery>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductQuery&&(identical(other.page, page) || other.page == page)&&(identical(other.pageSize, pageSize) || other.pageSize == pageSize)&&(identical(other.search, search) || other.search == search)&&(identical(other.categorySlug, categorySlug) || other.categorySlug == categorySlug)&&const DeepCollectionEquality().equals(other._brandSlugs, _brandSlugs)&&(identical(other.minPriceCents, minPriceCents) || other.minPriceCents == minPriceCents)&&(identical(other.maxPriceCents, maxPriceCents) || other.maxPriceCents == maxPriceCents)&&(identical(other.onSale, onSale) || other.onSale == onSale)&&(identical(other.featured, featured) || other.featured == featured)&&(identical(other.sort, sort) || other.sort == sort));
}


@override
int get hashCode => Object.hash(runtimeType,page,pageSize,search,categorySlug,const DeepCollectionEquality().hash(_brandSlugs),minPriceCents,maxPriceCents,onSale,featured,sort);

@override
String toString() {
  return 'ProductQuery(page: $page, pageSize: $pageSize, search: $search, categorySlug: $categorySlug, brandSlugs: $brandSlugs, minPriceCents: $minPriceCents, maxPriceCents: $maxPriceCents, onSale: $onSale, featured: $featured, sort: $sort)';
}


}

/// @nodoc
abstract mixin class _$ProductQueryCopyWith<$Res> implements $ProductQueryCopyWith<$Res> {
  factory _$ProductQueryCopyWith(_ProductQuery value, $Res Function(_ProductQuery) _then) = __$ProductQueryCopyWithImpl;
@override @useResult
$Res call({
 int? page, int? pageSize, String? search, String? categorySlug, List<String> brandSlugs, int? minPriceCents, int? maxPriceCents, bool onSale, bool featured, ProductSort? sort
});




}
/// @nodoc
class __$ProductQueryCopyWithImpl<$Res>
    implements _$ProductQueryCopyWith<$Res> {
  __$ProductQueryCopyWithImpl(this._self, this._then);

  final _ProductQuery _self;
  final $Res Function(_ProductQuery) _then;

/// Create a copy of ProductQuery
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? page = freezed,Object? pageSize = freezed,Object? search = freezed,Object? categorySlug = freezed,Object? brandSlugs = null,Object? minPriceCents = freezed,Object? maxPriceCents = freezed,Object? onSale = null,Object? featured = null,Object? sort = freezed,}) {
  return _then(_ProductQuery(
page: freezed == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int?,pageSize: freezed == pageSize ? _self.pageSize : pageSize // ignore: cast_nullable_to_non_nullable
as int?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,categorySlug: freezed == categorySlug ? _self.categorySlug : categorySlug // ignore: cast_nullable_to_non_nullable
as String?,brandSlugs: null == brandSlugs ? _self._brandSlugs : brandSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,minPriceCents: freezed == minPriceCents ? _self.minPriceCents : minPriceCents // ignore: cast_nullable_to_non_nullable
as int?,maxPriceCents: freezed == maxPriceCents ? _self.maxPriceCents : maxPriceCents // ignore: cast_nullable_to_non_nullable
as int?,onSale: null == onSale ? _self.onSale : onSale // ignore: cast_nullable_to_non_nullable
as bool,featured: null == featured ? _self.featured : featured // ignore: cast_nullable_to_non_nullable
as bool,sort: freezed == sort ? _self.sort : sort // ignore: cast_nullable_to_non_nullable
as ProductSort?,
  ));
}


}

// dart format on
